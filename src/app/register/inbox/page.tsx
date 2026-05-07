"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Inbox as InboxIcon,
  RefreshCw,
} from "lucide-react";
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
import {
  deleteInboxFile,
  fetchInboxBlob,
  listInboxFiles,
  readInboxSavedAt,
  readOcrCache,
  writeInboxSavedAt,
  writeOcrCache,
  type InboxFile,
} from "@/lib/firebase/inbox";
import { SEED_PRESETS, type CropPreset } from "@/lib/preset";
import { useLocalSettings } from "@/lib/localSettings";
import { Button, ConfirmDialog, Toast } from "@/components/ui";
import BulkRow from "@/components/BulkRow";
import { useDirtyTracker } from "@/lib/unsavedChanges";

/**
 * Receiving box for images uploaded by the public viewer to Storage `inbox/`.
 *
 * Entries live in the shared BulkDraftProvider (alongside /register/bulk
 * draft entries) so that /register?entryId=xxx can hydrate the detailed
 * editor from this page's rows.  We distinguish inbox-sourced entries by
 * the presence of `inboxStoragePath` and lock saved rows with `savedAt`.
 *
 * Differences vs /register/bulk:
 *   - Source images come from Storage (fetch via /api or downloadURL),
 *     not from a file picker.
 *   - Successful saveBulkEntry sets entry.savedAt and keeps the row in the
 *     list — Storage objects are deleted only when the user clicks ×.
 *   - OCR results are persisted to the Storage object's customMetadata so
 *     subsequent loads skip the Claude API call.
 */
export default function InboxRegisterPage() {
  const settings = useSettings();
  const allItems = useItems();
  const { settings: local } = useLocalSettings();
  const bulk = useBulkDraft();

  const presets: CropPreset[] = useMemo(
    () =>
      settings?.cropPresets && settings.cropPresets.length > 0
        ? settings.cropPresets
        : SEED_PRESETS,
    [settings?.cropPresets],
  );

  const inboxEntries = useMemo(
    () => bulk.entries.filter((e) => e.inboxStoragePath !== undefined),
    [bulk.entries],
  );

  const [loading, setLoading] = useState(false);
  /** How many rows are still going through processBulkSource. */
  const [processingCount, setProcessingCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | undefined>();
  /**
   * Non-fatal warning surfaced via Toast when the saved-state customMetadata
   * write fails ( the item is already in Firestore — only the inbox badge
   * persistence broke ) .
   */
  const [metaWarn, setMetaWarn] = useState<string | undefined>();
  const [confirmRemove, setConfirmRemove] = useState<{
    entryId: string;
    name: string;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  /** Keep the InboxFile ref around so the visible-page queue can resolve
   *  it back when an entry actually scrolls into view.  We don't store
   *  this on BulkEntry itself ( BulkEntry is shared with /register/bulk
   *  which has no concept of an InboxFile ) . */
  const inboxFilesRef = useRef<Map<string, InboxFile>>(new Map());
  /** entry.id set: rows we've already kicked off processRow for.  Prevents
   *  double-processing when pages overlap or when an entry is re-rendered
   *  while still processing. */
  const queuedRef = useRef<Set<string>>(new Set());

  const pageSize: number = local.inboxPageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(inboxEntries.length / pageSize));

  // Clamp currentPage when the entry list shrinks below it ( e.g. user
  // deletes the last row of the last page ) .
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return inboxEntries.slice(start, start + pageSize);
  }, [inboxEntries, currentPage, pageSize]);

  // Inbox source images live in Storage so they can always be re-fetched,
  // but the BulkDraftProvider holds the per-row form patches + the in-memory
  // source blob; both are dropped when the user navigates outside /register.
  // Warn whenever there's still a row that hasn't been saved.
  const hasUnsavedInbox = inboxEntries.some((e) => e.savedAt === undefined);
  useDirtyTracker(hasUnsavedInbox);

  // Visible-only OCR queue: kick off processRow for rows on the current
  // page that we haven't queued yet.  Runs sequentially in the background
  // ( shared tesseract worker, Claude rate limits ) .
  useEffect(() => {
    const targets = pagedEntries.filter(
      (e) =>
        !queuedRef.current.has(e.id) &&
        e.status === "processing" &&
        inboxFilesRef.current.has(e.id),
    );
    if (targets.length === 0) return;
    targets.forEach((e) => queuedRef.current.add(e.id));
    setProcessingCount((c) => c + targets.length);
    void (async () => {
      for (const entry of targets) {
        const file = inboxFilesRef.current.get(entry.id);
        if (!file) continue;
        await processRow(entry, file);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagedEntries]);

  // Initial fetch on mount.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss the metadata-write warning Toast after 6s.
  useEffect(() => {
    if (!metaWarn) return;
    const t = setTimeout(() => setMetaWarn(undefined), 6000);
    return () => clearTimeout(t);
  }, [metaWarn]);

  /** Process one row.  Reads the OCR cache first; only calls Claude when the
   *  cache is empty, then writes the result back so the next page load is
   *  free.  Updates the row's status as side-effects. */
  const processRow = async (entry: BulkEntry, file: InboxFile) => {
    try {
      console.log("[inbox] start:", file.name);
      const blob = await fetchInboxBlob(file);
      console.log("[inbox] downloaded:", file.name, blob.size, "bytes");
      bulk.setSourceBlob(entry.id, blob);

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
      bulk.updateEntry(entry.id, {
        ...patch,
        status: "ready",
        checked: valid,
      });

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
      bulk.updateEntry(entry.id, {
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

    // Use the latest entries from the provider (closure may be stale across
    // back-to-back refresh() invocations, hence reading via bulk.entries).
    const knownPaths = new Set(
      bulk.entries
        .map((e) => e.inboxStoragePath)
        .filter((p): p is string => !!p),
    );
    const newFiles = listed.filter((f) => !knownPaths.has(f.path));

    if (newFiles.length === 0) {
      if (listed.length === inboxEntries.length) setInfo("新着なし");
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
          priceSource: "なんおし",
          checkedAt: f.uploadedAt,
          checked: false,
          inboxStoragePath: f.path,
          // Persisted via writeInboxSavedAt → keeps the 登録済み badge +
          // locked checkbox across reloads. processRow still runs ( cachedOcr
          // hit so no Claude call ) so the thumbnail / fields populate as
          // usual; only the saved-state survives.
          savedAt: readInboxSavedAt(f),
        },
        file: f,
      }),
    );

    // Stash the InboxFile keyed by the entry id so the visible-page queue
    // effect can resolve it later ( we don't kick off processRow here —
    // only the entries on the current page get processed, see useEffect
    // on pagedEntries above ) .
    created.forEach(({ entry, file }) => {
      inboxFilesRef.current.set(entry.id, file);
    });

    bulk.setEntries((prev) => [...prev, ...created.map((c) => c.entry)]);
    // List is in the DOM — drop the page-level "loading" so the visible-only
    // OCR queue can take over.
    setLoading(false);
  };

  const onChangePreset = async (entryId: string, presetId: string) => {
    const entry = bulk.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const source = entry.sourceWidth
      ? { width: entry.sourceWidth, height: entry.sourceHeight ?? 0 }
      : undefined;
    if (!source) return;
    const blob = bulk.getSourceBlob(entryId);

    if (presetId === "") {
      bulk.updateEntry(entryId, {
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
    bulk.updateEntry(entryId, patch);

    if (blob) {
      try {
        const url = await renderIconThumb(blob, preset.icon);
        bulk.updateEntry(entryId, { iconThumbDataUrl: url });
      } catch {
        /* ignore */
      }
    }
  };

  const onToggleCheck = (entry: BulkEntry, next: boolean) => {
    if (entry.savedAt !== undefined) return;
    if (next && bulkEntryMissingFields(entry).length > 0) return;
    bulk.updateEntry(entry.id, { checked: next });
  };

  const onConfirmRemove = async () => {
    if (!confirmRemove) return;
    const entryId = confirmRemove.entryId;
    const entry = bulk.entries.find((e) => e.id === entryId);
    const path = entry?.inboxStoragePath;
    const cleanupRefs = () => {
      inboxFilesRef.current.delete(entryId);
      queuedRef.current.delete(entryId);
    };
    if (!path) {
      cleanupRefs();
      bulk.removeEntry(entryId);
      setConfirmRemove(null);
      return;
    }
    setBusy(true);
    try {
      await deleteInboxFile(path);
      cleanupRefs();
      bulk.removeEntry(entryId);
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
    const targets = inboxEntries.filter(
      (e) => e.checked && e.savedAt === undefined,
    );
    if (targets.length === 0) return;
    setError(undefined);
    setInfo(undefined);
    setMetaWarn(undefined);
    setBusy(true);
    let succeeded = 0;
    let failed = 0;
    let metaFailed = 0;
    for (const entry of targets) {
      try {
        const source = bulk.getSourceBlob(entry.id);
        if (!source) throw new Error("元画像が見つかりません");
        await saveBulkEntry({ entry, source, allItems: allItems ?? [] });
        const ts = Date.now();
        // Inbox flow: do NOT remove. Mark saved + uncheck so it doesn't
        // get included again, and BulkRow shows the 登録済み badge.
        bulk.updateEntry(entry.id, {
          savedAt: ts,
          checked: false,
        });
        // Persist the saved-state into Storage customMetadata so the badge
        // survives a reload. updateMetadata is merge-semantic so cachedOcr
        // and any viewer-set keys stay intact. Failures are non-fatal —
        // the item was already created in Firestore — surface a Toast.
        if (entry.inboxStoragePath) {
          try {
            await writeInboxSavedAt(entry.inboxStoragePath, ts);
          } catch (metaErr) {
            console.warn(
              "[inbox] writeInboxSavedAt failed:",
              entry.inboxStoragePath,
              metaErr,
            );
            metaFailed++;
          }
        }
        succeeded++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "保存に失敗しました";
        bulk.updateEntry(entry.id, {
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
    if (metaFailed > 0) {
      setMetaWarn(
        `${metaFailed} 件は登録済み状態の保存に失敗しました。リロードすると未登録表示に戻ります`,
      );
    }
  };

  const ocrLabel =
    local.ocrProvider === "claude" && local.claudeApiKey
      ? `Claude (${local.claudeModel || "default"})`
      : "Tesseract (端末)";

  const checkedCount = inboxEntries.filter(
    (e) => e.checked && e.savedAt === undefined,
  ).length;

  const totalCount = inboxEntries.length;
  const savedCount = inboxEntries.filter(
    (e) => e.savedAt !== undefined,
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
          {totalPages > 1 && (
            <span className="ml-2">
              ・ ページ {currentPage} / {totalPages}
            </span>
          )}
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

      {inboxEntries.length === 0 ? (
        <EmptyState loading={loading} />
      ) : (
        <>
          <ul className="-mx-2 border-t border-[var(--color-line)]">
            {pagedEntries.map((e) => (
              <li key={e.id}>
                <BulkRow
                  entry={e}
                  presets={presets}
                  editHref={`/register?entryId=${e.id}`}
                  onToggleCheck={(next) => onToggleCheck(e, next)}
                  onChangePreset={(pid) => void onChangePreset(e.id, pid)}
                  onRemove={() =>
                    setConfirmRemove({
                      entryId: e.id,
                      name: e.name || e.fileName || "(名称未取得)",
                    })
                  }
                  savedAt={e.savedAt}
                />
              </li>
            ))}
          </ul>
          <Pagination
            current={currentPage}
            total={totalPages}
            onChange={setCurrentPage}
          />
        </>
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

      <Toast
        open={metaWarn !== undefined}
        message={metaWarn ?? ""}
        tone="warn"
      />

      {inboxEntries.length > 0 && (
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

/** Compact numbered pagination ( ‹ 1 2 3 ... N › ) .  Hides itself when
 *  there's only one page.  Mobile-friendly: 32px hit targets, current page
 *  picked out with the deep-teal accent. */
function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (next: number) => void;
}) {
  if (total <= 1) return null;

  const pages = computeVisiblePages(current, total);

  const navBtnBase =
    "w-8 h-8 inline-flex items-center justify-center text-[12px] tabular-nums " +
    "border border-[var(--color-line)] bg-white text-[var(--color-text)] " +
    "transition-colors hover:bg-[var(--color-line-soft)] " +
    "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white";

  return (
    <nav
      className="flex items-center justify-center gap-1 mt-4 flex-wrap"
      aria-label="ページ送り"
      style={{ fontFamily: "var(--font-label)" }}
    >
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className={navBtnBase}
        aria-label="前のページ"
      >
        <ChevronLeft size={14} strokeWidth={1.8} />
      </button>
      {pages.map((p, idx) =>
        p === "…" ? (
          <span
            key={`ellipsis-${idx}`}
            className="px-1 text-[var(--color-muted)] text-[12px]"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === current ? "page" : undefined}
            className={
              p === current
                ? "w-8 h-8 inline-flex items-center justify-center text-[12px] tabular-nums " +
                  "bg-[var(--color-gold-deep)] text-white border border-[var(--color-gold-deep)]"
                : navBtnBase
            }
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className={navBtnBase}
        aria-label="次のページ"
      >
        <ChevronRight size={14} strokeWidth={1.8} />
      </button>
    </nav>
  );
}

/** Generate "1, …, current-1, current, current+1, …, total" with at most
 *  ~7 entries.  Always includes 1 and total; ellipses fill the gaps. */
function computeVisiblePages(
  current: number,
  total: number,
): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | "…"> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("…");
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < total - 1) pages.push("…");
  pages.push(total);
  return pages;
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
