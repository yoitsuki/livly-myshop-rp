"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Inbox as InboxIcon, RefreshCw } from "lucide-react";
import { useItems, useSettings } from "@/lib/firebase/hooks";
import { uid } from "@/lib/firebase/repo";
import { saveBulkEntry } from "@/lib/bulk/save";
import {
  bulkEntryMissingFields,
  type BulkEntry,
} from "@/lib/bulk/types";
import {
  applyPresetRects,
  processBulkSource,
  renderIconThumb,
} from "@/lib/bulk/process";
import {
  deleteInboxFile,
  fetchInboxBlob,
  listInboxFiles,
  readOcrCache,
  writeOcrCache,
  type InboxFile,
} from "@/lib/firebase/inbox";
import { SEED_PRESETS, type CropPreset } from "@/lib/preset";
import { useLocalSettings } from "@/lib/localSettings";
import { Button, ConfirmDialog } from "@/components/ui";
import BulkRow from "@/components/BulkRow";

interface InboxRowMeta {
  /** Storage path so × can delete the source. */
  path: string;
  /** When the saveBulkEntry succeeded (epoch ms). undefined = not saved. */
  savedAt?: number;
}

export default function InboxRegisterPage() {
  const settings = useSettings();
  const allItems = useItems();
  const { settings: local } = useLocalSettings();

  const presets: CropPreset[] = useMemo(
    () =>
      settings?.cropPresets && settings.cropPresets.length > 0
        ? settings.cropPresets
        : SEED_PRESETS,
    [settings?.cropPresets],
  );

  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [meta, setMeta] = useState<Record<string, InboxRowMeta>>({});
  const blobsRef = useRef<Map<string, Blob>>(new Map());
  // Tracks every Storage path we've already turned into a row.  Synchronously
  // updated so back-to-back refresh() calls don't double-create entries.
  const seenPathsRef = useRef<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  /** How many rows are still going through processBulkSource. */
  const [processingCount, setProcessingCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | undefined>();
  const [confirmRemove, setConfirmRemove] = useState<{
    entryId: string;
    name: string;
  } | null>(null);

  // Initial fetch on mount.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateEntry = (id: string, patch: Partial<BulkEntry>) =>
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );

  const removeLocalEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setMeta((prev) => {
      const path = prev[id]?.path;
      if (path) seenPathsRef.current.delete(path);
      const next = { ...prev };
      delete next[id];
      return next;
    });
    blobsRef.current.delete(id);
  };

  /** Process one row.  Reads the OCR cache first; only calls Claude when the
   *  cache is empty, then writes the result back so the next page load is
   *  free.  Updates the row's status as side-effects.  Logs progress so the
   *  Safari Web Inspector / Chrome console can show where a row got stuck. */
  const processRow = async (entry: BulkEntry, file: InboxFile) => {
    try {
      console.log("[inbox] start:", file.name);
      const blob = await fetchInboxBlob(file);
      console.log("[inbox] downloaded:", file.name, blob.size, "bytes");
      blobsRef.current.set(entry.id, blob);

      const cached = readOcrCache(file);
      console.log(
        "[inbox] cache:",
        file.name,
        cached ? "hit (skip OCR)" : "miss",
      );
      const patch = await processBulkSource(blob, presets, {
        skipOcr: cached !== null,
      });
      console.log("[inbox] processed:", file.name, "name=", patch.name);

      if (cached) {
        if (cached.name !== undefined) patch.name = cached.name;
        if (cached.category !== undefined) patch.category = cached.category;
        if (cached.minPrice !== undefined) patch.minPrice = cached.minPrice;
        if (cached.refPriceMin !== undefined)
          patch.refPriceMin = cached.refPriceMin;
        if (cached.refPriceMax !== undefined)
          patch.refPriceMax = cached.refPriceMax;
      }

      const draft = { ...entry, ...patch, status: "ready" as const };
      const valid = bulkEntryMissingFields(draft).length === 0;
      updateEntry(entry.id, {
        ...patch,
        status: "ready",
        checked: valid,
      });

      // Persist OCR results.  Always write on a fresh call (even when fields
      // are empty) so we never re-bill the API for the same file.  User can
      // delete + re-upload to retry if Claude misread.
      if (!cached) {
        try {
          await writeOcrCache(file.path, {
            name: patch.name,
            category: patch.category,
            minPrice: patch.minPrice,
            refPriceMin: patch.refPriceMin,
            refPriceMax: patch.refPriceMax,
            cachedAt: Date.now(),
          });
        } catch (e) {
          console.warn("OCR cache write failed:", e);
        }
      }
    } catch (e) {
      console.error("[inbox] failed:", file.name, e);
      updateEntry(entry.id, {
        status: "failed",
        error:
          e instanceof Error
            ? `${e.name}: ${e.message}`
            : "処理に失敗しました",
      });
    } finally {
      setProcessingCount((c) => Math.max(0, c - 1));
    }
  };

  const refresh = async () => {
    setError(undefined);
    setInfo(undefined);
    setLoading(true);

    let listed: InboxFile[];
    try {
      listed = await listInboxFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "受信BOX の取得に失敗しました");
      setLoading(false);
      return;
    }

    const newFiles = listed.filter((f) => !seenPathsRef.current.has(f.path));

    if (newFiles.length === 0) {
      if (listed.length === entries.length) setInfo("新着なし");
      setLoading(false);
      return;
    }

    const created: { entry: BulkEntry; file: InboxFile }[] = newFiles.map(
      (f) => ({
        entry: {
          id: uid(),
          fileName: f.name,
          fileSize: f.size,
          status: "processing",
          name: "",
          category: "",
          tagIds: [],
          minPrice: 0,
          refPriceMin: 0,
          refPriceMax: 0,
          checkedAt: f.uploadedAt,
          checked: false,
        },
        file: f,
      }),
    );

    setEntries((prev) => [...prev, ...created.map((c) => c.entry)]);
    setMeta((prev) => {
      const next = { ...prev };
      created.forEach(({ entry, file }) => {
        next[entry.id] = { path: file.path };
      });
      return next;
    });
    created.forEach(({ file }) => seenPathsRef.current.add(file.path));
    setProcessingCount((c) => c + created.length);
    // List is in the DOM — drop the page-level "loading" before the slow
    // OCR loop starts so the user sees rows + per-row spinners.
    setLoading(false);

    for (const item of created) {
      await processRow(item.entry, item.file);
    }
  };

  const onChangePreset = async (entryId: string, presetId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const source = entry.sourceWidth
      ? { width: entry.sourceWidth, height: entry.sourceHeight ?? 0 }
      : undefined;
    if (!source) return;
    const blob = blobsRef.current.get(entryId);

    if (presetId === "") {
      updateEntry(entryId, {
        presetId: undefined,
        iconRect: undefined,
        mainRect: undefined,
        iconCrop: undefined,
        mainCrop: undefined,
        iconThumbDataUrl: undefined,
      });
      return;
    }
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    const patch = applyPresetRects(preset.id, preset.icon, preset.main, source);
    updateEntry(entryId, patch);

    if (blob) {
      try {
        const url = await renderIconThumb(blob, preset.icon);
        updateEntry(entryId, { iconThumbDataUrl: url });
      } catch {
        /* ignore */
      }
    }
  };

  const onToggleCheck = (entry: BulkEntry, next: boolean) => {
    if (meta[entry.id]?.savedAt !== undefined) return;
    if (next && bulkEntryMissingFields(entry).length > 0) return;
    updateEntry(entry.id, { checked: next });
  };

  const onConfirmRemove = async () => {
    if (!confirmRemove) return;
    const path = meta[confirmRemove.entryId]?.path;
    if (!path) {
      removeLocalEntry(confirmRemove.entryId);
      setConfirmRemove(null);
      return;
    }
    setBusy(true);
    try {
      await deleteInboxFile(path);
      removeLocalEntry(confirmRemove.entryId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Storage からの削除に失敗しました",
      );
    } finally {
      setBusy(false);
      setConfirmRemove(null);
    }
  };

  const onSave = async () => {
    const targets = entries.filter(
      (e) => e.checked && meta[e.id]?.savedAt === undefined,
    );
    if (targets.length === 0) return;
    setError(undefined);
    setInfo(undefined);
    setBusy(true);
    let succeeded = 0;
    let failed = 0;
    for (const entry of targets) {
      try {
        const source = blobsRef.current.get(entry.id);
        if (!source) throw new Error("元画像が見つかりません");
        await saveBulkEntry({ entry, source, allItems: allItems ?? [] });
        // Inbox flow: do NOT remove. Mark saved + uncheck so it doesn't
        // get included again, and BulkRow shows the 登録済み badge.
        const now = Date.now();
        setMeta((prev) => ({
          ...prev,
          [entry.id]: { ...prev[entry.id], savedAt: now },
        }));
        updateEntry(entry.id, { checked: false });
        succeeded++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "保存に失敗しました";
        updateEntry(entry.id, {
          error: `保存失敗: ${msg}`,
          checked: false,
        });
        failed++;
      }
    }
    setBusy(false);
    if (failed === 0) {
      setInfo(`${succeeded} 件登録しました。残したい間は × を押さずに保管できます`);
    } else {
      setError(
        `${succeeded} 件保存・${failed} 件失敗。失敗行を確認してください`,
      );
    }
  };

  const ocrLabel =
    local.ocrProvider === "claude" && local.claudeApiKey
      ? `Claude (${local.claudeModel || "default"})`
      : "Tesseract (端末)";

  const checkedCount = entries.filter(
    (e) => e.checked && meta[e.id]?.savedAt === undefined,
  ).length;

  const totalCount = entries.length;
  const savedCount = entries.filter(
    (e) => meta[e.id]?.savedAt !== undefined,
  ).length;

  return (
    <div className="pt-3 pb-32 space-y-4">
      <header className="space-y-1">
        <h1
          className="text-[22px] tracking-[0.04em] text-[var(--color-gold-deep)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          受信BOX
        </h1>
        <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed">
          閲覧用アプリから送られた画像を一覧から取り込みます。登録しても
          画像は残るので、いらなくなったら明示的に × で削除してください。
        </p>
      </header>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          icon={<RefreshCw size={16} />}
          onClick={() => void refresh()}
          loading={loading}
          disabled={loading || busy}
        >
          {loading ? "読み込み中…" : "更新"}
        </Button>
        <span
          className="text-[10.5px] text-[var(--color-muted)] tabular-nums ml-auto"
          style={{ fontFamily: "var(--font-label)", letterSpacing: "0.08em" }}
        >
          OCR : {ocrLabel}
        </span>
      </div>

      {totalCount > 0 && (
        <div
          className="text-[11px] text-[var(--color-muted)] tabular-nums px-1"
          style={{ fontFamily: "var(--font-label)", letterSpacing: "0.08em" }}
        >
          {totalCount} 件 / 登録済み {savedCount} 件
          {processingCount > 0 && (
            <span className="ml-2 text-[var(--color-gold-deep)]">
              ・ 解析中 {processingCount} 件
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)] px-3 py-2 text-[13px] text-text">
          {error}
        </div>
      )}
      {info && !error && (
        <div className="bg-[#e8f0e8] border border-[var(--color-gold-deep)] px-3 py-2 text-[13px] text-text">
          {info}
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState loading={loading} />
      ) : (
        <ul className="-mx-2 border-t border-[var(--color-line)]">
          {entries.map((e) => (
            <li key={e.id}>
              <BulkRow
                entry={e}
                presets={presets}
                onToggleCheck={(next) => onToggleCheck(e, next)}
                onChangePreset={(pid) => void onChangePreset(e.id, pid)}
                onRemove={() =>
                  setConfirmRemove({
                    entryId: e.id,
                    name: e.name || e.fileName || "(名称未取得)",
                  })
                }
                savedAt={meta[e.id]?.savedAt}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        message={
          confirmRemove
            ? `「${confirmRemove.name}」を 受信BOX から削除しますか？\n登録対象から外して残す場合はチェックボックスをOFFにしてください。\n( 削除すると Storage 上の画像も消えます )`
            : ""
        }
        busy={busy}
        onConfirm={() => void onConfirmRemove()}
        onCancel={() => setConfirmRemove(null)}
      />

      {entries.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--color-line)] bg-[var(--color-cream)]">
          <div className="max-w-screen-sm mx-auto px-4 py-3 flex gap-2">
            <Link href="/">
              <Button variant="secondary" size="lg">
                ホーム
              </Button>
            </Link>
            <div className="flex-1">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={checkedCount === 0 || busy}
                loading={busy}
                onClick={() => void onSave()}
              >
                {busy
                  ? "保存中…"
                  : checkedCount > 0
                    ? `登録 (${checkedCount} 件)`
                    : "登録するアイテムを選択"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="mt-10 px-4 py-10 text-center">
      <InboxIcon
        size={36}
        strokeWidth={1.4}
        className="mx-auto text-[var(--color-muted)] mb-3"
      />
      <div
        className="text-[16px] text-[var(--color-text)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {loading ? "読み込み中…" : "受信BOX は空です"}
      </div>
      {!loading && (
        <div className="text-[12px] text-[var(--color-muted)] mt-1.5 leading-relaxed">
          閲覧用アプリから画像をアップロードすると、
          <br />
          ここに並びます。
        </div>
      )}
    </div>
  );
}
