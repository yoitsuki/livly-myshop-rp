"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Plus } from "lucide-react";
import { useItems, useSettings } from "@/lib/firebase/hooks";
import { uid } from "@/lib/firebase/repo";
import { saveBulkEntry } from "@/lib/bulk/save";
import { useBulkDraft } from "@/lib/bulk/context";
import {
  bulkEntryMissingFields,
  type BulkEntry,
} from "@/lib/bulk/types";
import {
  applyPresetRects,
  processBulkSource,
  renderIconThumb,
} from "@/lib/bulk/process";
import { SEED_PRESETS, type CropPreset } from "@/lib/preset";
import { useLocalSettings } from "@/lib/localSettings";
import { Button, ConfirmDialog } from "@/components/ui";
import BulkRow from "@/components/BulkRow";

export default function BulkRegisterPage() {
  const router = useRouter();
  const settings = useSettings();
  const allItems = useItems();
  const { settings: local } = useLocalSettings();
  const {
    entries,
    setEntries,
    updateEntry,
    removeEntry,
    setSourceBlob,
    getSourceBlob,
    hasSource,
  } = useBulkDraft();
  const presets: CropPreset[] = useMemo(
    () =>
      settings?.cropPresets && settings.cropPresets.length > 0
        ? settings.cropPresets
        : SEED_PRESETS,
    [settings?.cropPresets],
  );
  // Inbox-sourced rows live in the same provider but belong to /register/inbox.
  // Filter them out so this page only sees / saves bulk-picker entries.
  const bulkOnlyEntries = useMemo(
    () => entries.filter((e) => e.inboxStoragePath === undefined),
    [entries],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmRemove, setConfirmRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // If we land here with stale bulk entries whose source Blobs are gone
  // (browser refresh), wipe them — fresh-start on refresh.  Inbox-sourced
  // entries are left alone (they live in /register/inbox).
  useEffect(() => {
    if (bulkOnlyEntries.length === 0) return;
    const stale = bulkOnlyEntries.some((e) => !hasSource(e.id));
    if (stale) {
      bulkOnlyEntries.forEach((e) => removeEntry(e.id));
    }
    // Only run once on mount; entries change naturally inside this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = async (filesArg: FileList | null) => {
    if (!filesArg || filesArg.length === 0) return;
    setError(undefined);
    const files = Array.from(filesArg);
    const created: BulkEntry[] = files.map((f) => ({
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
      // メイン画像なし時の 情報元 既定値。saveBulkEntry が mainBlob ありなら
      // 捨てる ので、メイン画像が出てきたケースでも書き込みには影響しない。
      priceSource: "なんおし",
      checkedAt: f.lastModified || Date.now(),
      checked: false,
    }));
    files.forEach((f, i) => setSourceBlob(created[i].id, f));
    setEntries((prev) => [...prev, ...created]);

    setBusy(true);
    try {
      // Sequential: tesseract worker is shared and Claude API rate-limits.
      for (let i = 0; i < created.length; i++) {
        const entry = created[i];
        const source = files[i];
        try {
          const patch = await processBulkSource(source, presets);
          const draft = { ...entry, ...patch, status: "ready" as const };
          const valid = bulkEntryMissingFields(draft).length === 0;
          updateEntry(entry.id, {
            ...patch,
            status: "ready",
            checked: valid,
          });
        } catch (e) {
          updateEntry(entry.id, {
            status: "failed",
            error: e instanceof Error ? e.message : "処理に失敗しました",
          });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const onChangePreset = async (entryId: string, presetId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const source = entry.sourceWidth
      ? { width: entry.sourceWidth, height: entry.sourceHeight ?? 0 }
      : undefined;
    if (!source) return;
    const blob = getSourceBlob(entryId);

    if (presetId === "") {
      // Unset preset.
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

    // Regenerate thumb async — best effort.
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
    if (next && bulkEntryMissingFields(entry).length > 0) return;
    updateEntry(entry.id, { checked: next });
  };

  const onBulkSave = async () => {
    const targets = bulkOnlyEntries.filter((e) => e.checked);
    if (targets.length === 0) return;
    setError(undefined);
    setBusy(true);
    let succeeded = 0;
    let failed = 0;
    for (const entry of targets) {
      try {
        const source = getSourceBlob(entry.id);
        if (!source) throw new Error("元画像が見つかりません");
        await saveBulkEntry({ entry, source, allItems: allItems ?? [] });
        removeEntry(entry.id);
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
      router.push("/");
      return;
    }
    setError(
      `${succeeded} 件保存・${failed} 件失敗。失敗行を編集して再試行してください`,
    );
  };

  const ocrLabel =
    local.ocrProvider === "claude" && local.claudeApiKey
      ? `Claude (${local.claudeModel || "default"})`
      : "Tesseract (端末)";

  const checkedCount = bulkOnlyEntries.filter((e) => e.checked).length;

  return (
    <div className="pt-3 pb-32 space-y-4">
      <header className="space-y-1">
        <h1
          className="text-[22px] tracking-[0.04em] text-[var(--color-gold-deep)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          まとめて登録
        </h1>
        <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed">
          画像を複数選択 → OCR とプリセットで自動入力 → 行をタップして編集 →
          下部「登録」でまとめて保存。
        </p>
      </header>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void onPick(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          variant={bulkOnlyEntries.length === 0 ? "primary" : "secondary"}
          size="md"
          icon={<Plus size={16} />}
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {bulkOnlyEntries.length === 0 ? "画像を選択" : "画像を追加"}
        </Button>
        <span
          className="text-[10.5px] text-[var(--color-muted)] tabular-nums ml-auto"
          style={{ fontFamily: "var(--font-label)", letterSpacing: "0.08em" }}
        >
          OCR : {ocrLabel}
        </span>
      </div>

      {error && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)] px-3 py-2 text-[13px] text-text">
          {error}
        </div>
      )}

      {bulkOnlyEntries.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="-mx-2 border-t border-[var(--color-line)]">
          {bulkOnlyEntries.map((e) => (
            <li key={e.id}>
              <BulkRow
                entry={e}
                presets={presets}
                editHref={`/register?entryId=${e.id}`}
                onToggleCheck={(next) => onToggleCheck(e, next)}
                onChangePreset={(pid) => void onChangePreset(e.id, pid)}
                onRemove={() =>
                  setConfirmRemove({
                    id: e.id,
                    name: e.name || e.fileName || "(名称未取得)",
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        message={
          confirmRemove
            ? `「${confirmRemove.name}」をリストから削除しますか？\n登録対象から外して残す場合はチェックボックスをOFFにしてください。`
            : ""
        }
        onConfirm={() => {
          if (confirmRemove) removeEntry(confirmRemove.id);
          setConfirmRemove(null);
        }}
        onCancel={() => setConfirmRemove(null)}
      />

      {bulkOnlyEntries.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--color-line)] bg-[var(--color-cream)]">
          <div className="max-w-screen-sm mx-auto px-4 py-3 flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                // Drop only this page's bulk entries, leave inbox rows alone.
                bulkOnlyEntries.forEach((e) => removeEntry(e.id));
                router.push("/");
              }}
            >
              キャンセル
            </Button>
            <div className="flex-1">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={checkedCount === 0 || busy}
                loading={busy}
                onClick={() => void onBulkSave()}
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

function EmptyState() {
  return (
    <div className="mt-10 px-4 py-10 text-center">
      <ImageIcon
        size={36}
        strokeWidth={1.4}
        className="mx-auto text-[var(--color-muted)] mb-3"
      />
      <div
        className="text-[16px] text-[var(--color-text)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        画像を選択してください
      </div>
      <div className="text-[12px] text-[var(--color-muted)] mt-1.5 leading-relaxed">
        マイショップのスクショを複数まとめて選ぶと、
        <br />
        EXIF と OCR から候補が自動入力されます。
      </div>
    </div>
  );
}

