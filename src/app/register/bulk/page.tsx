"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { useItems, useSettings } from "@/lib/firebase/hooks";
import {
  createItem,
  isNewestYearMonth,
  mergeItemPriceEntry,
  uid,
  type PriceEntry,
} from "@/lib/firebase/repo";
import { cropAndEncode } from "@/lib/image";
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
import { formatShopPeriod, roundAgeIndex } from "@/lib/shopPeriods";
import { formatPrice } from "@/lib/utils/parsePrice";
import { useLocalSettings } from "@/lib/localSettings";
import { Button, ConfirmDialog, IconButton } from "@/components/ui";

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
    clear,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmRemove, setConfirmRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // If we land here with stale entries whose source Blobs are gone (browser
  // refresh), wipe them — the user agreed to a fresh-start on refresh.
  useEffect(() => {
    if (entries.length === 0) return;
    const stale = entries.some((e) => !hasSource(e.id));
    if (stale) clear();
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
    const targets = entries.filter((e) => e.checked);
    if (targets.length === 0) return;
    setError(undefined);
    setBusy(true);
    let succeeded = 0;
    let failed = 0;
    for (const entry of targets) {
      try {
        const source = getSourceBlob(entry.id);
        if (!source) throw new Error("元画像が見つかりません");
        if (!entry.iconRect) throw new Error("アイコンの矩形が未設定です");

        const iconBlob = await cropAndEncode(source, entry.iconRect, {
          maxWidth: 320,
          quality: 0.85,
        });
        const mainBlob = entry.mainRect
          ? await cropAndEncode(source, entry.mainRect, {
              maxWidth: 1200,
              quality: 0.85,
            })
          : undefined;

        const trimmedName = entry.name.trim();
        const existingItem = (allItems ?? []).find(
          (i) => i.name === trimmedName,
        );

        if (existingItem) {
          // Same-name match: silently merge into the existing item.
          // Replace the main image only if the new entry's yearMonth is at
          // least as recent as every other yearMonth on the item.
          const newYearMonth = entry.shopPeriod?.yearMonth;
          const replaceMain =
            !!mainBlob && isNewestYearMonth(existingItem, newYearMonth);
          await mergeItemPriceEntry({
            itemId: existingItem.id,
            newEntry: {
              shopPeriod: entry.shopPeriod,
              refPriceMin: entry.refPriceMin,
              refPriceMax: entry.refPriceMax || entry.refPriceMin,
              checkedAt: entry.checkedAt,
              priceSource:
                !mainBlob && entry.priceSource ? entry.priceSource : undefined,
            },
            replaceMainImage:
              replaceMain && mainBlob
                ? { blob: mainBlob, crop: entry.mainCrop }
                : undefined,
          });
        } else {
          const initialEntry: PriceEntry = {
            id: uid(),
            shopPeriod: entry.shopPeriod,
            refPriceMin: entry.refPriceMin,
            refPriceMax: entry.refPriceMax || entry.refPriceMin,
            checkedAt: entry.checkedAt,
            priceSource:
              !mainBlob && entry.priceSource ? entry.priceSource : undefined,
            createdAt: Date.now(),
          };

          await createItem({
            iconBlob,
            mainImageBlob: mainBlob,
            iconCrop: entry.iconCrop,
            mainCrop: entry.mainCrop,
            name: trimmedName,
            category: entry.category.trim(),
            tagIds: entry.tagIds,
            minPrice: entry.minPrice,
            priceEntries: [initialEntry],
          });
        }
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

  const checkedCount = entries.filter((e) => e.checked).length;

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
          variant={entries.length === 0 ? "primary" : "secondary"}
          size="md"
          icon={<Plus size={16} />}
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {entries.length === 0 ? "画像を選択" : "画像を追加"}
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

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="-mx-2 border-t border-[var(--color-line)]">
          {entries.map((e, i) => (
            <li key={e.id}>
              <BulkRow
                index={i}
                entry={e}
                presets={presets}
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

      {entries.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--color-line)] bg-[var(--color-cream)]">
          <div className="max-w-screen-sm mx-auto px-4 py-3 flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                clear();
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

function BulkRow({
  index,
  entry,
  presets,
  onToggleCheck,
  onChangePreset,
  onRemove,
}: {
  index: number;
  entry: BulkEntry;
  presets: CropPreset[];
  onToggleCheck: (next: boolean) => void;
  onChangePreset: (presetId: string) => void;
  onRemove: () => void;
}) {
  const missing = bulkEntryMissingFields(entry);
  const processing = entry.status === "processing";
  const failed = entry.status === "failed";
  const disabled = processing || failed || missing.length > 0;

  const periodTier = entry.shopPeriod
    ? roundAgeIndex(entry.shopPeriod.yearMonth)
    : null;

  return (
    <div className="px-2 py-3 border-b border-[var(--color-line)] bg-white">
      <div className="flex gap-2.5">
        <div className="shrink-0 pt-1">
          <input
            type="checkbox"
            checked={entry.checked}
            disabled={disabled}
            onChange={(e) => onToggleCheck(e.target.checked)}
            aria-label="登録対象に含める"
            className="w-5 h-5 accent-[var(--color-gold-deep)] disabled:opacity-30"
          />
        </div>

        <Link
          href={`/register?bulkIndex=${index}`}
          className="flex-1 min-w-0 flex gap-2.5"
        >
          <div className="shrink-0 relative">
            <div
              className="w-[52px] h-[52px] border border-[var(--color-line)] bg-[var(--color-cream)] overflow-hidden flex items-center justify-center text-[var(--color-muted)]"
              style={{ borderRadius: 0 }}
            >
              {processing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : entry.iconThumbDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.iconThumbDataUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon size={20} strokeWidth={1.4} />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5">
              <h3
                className="flex-1 min-w-0 text-[var(--color-text)] leading-snug truncate"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 15,
                  fontWeight: 400,
                  letterSpacing: "0.02em",
                  margin: 0,
                }}
              >
                {entry.name || "(名称未取得)"}
              </h3>
              <ChevronRight
                size={16}
                strokeWidth={1.6}
                className="text-[var(--color-muted)] shrink-0 mt-1"
              />
            </div>

            <div
              className="flex items-center gap-1.5 mt-0.5 text-[var(--color-muted)] tabular-nums"
              style={{ fontFamily: "var(--font-body)", fontSize: 11 }}
            >
              <span className="truncate">{entry.category || "—"}</span>
              {entry.shopPeriod && periodTier !== null && (
                <PeriodBadgeMini
                  yearMonth={entry.shopPeriod.yearMonth}
                  phase={entry.shopPeriod.phase}
                  tier={periodTier <= 0 ? 0 : periodTier === 1 ? 1 : 2}
                />
              )}
              {entry.status === "ready" && entry.tagIds.length === 0 && (
                <span
                  className="shrink-0 inline-flex items-center leading-none whitespace-nowrap"
                  style={{
                    fontFamily: "var(--font-label)",
                    fontSize: 8.5,
                    fontWeight: 500,
                    letterSpacing: "0.14em",
                    padding: "2px 6px",
                    borderRadius: 0,
                    background: "transparent",
                    color: "var(--color-muted)",
                    border: "1px dashed var(--color-muted)",
                  }}
                >
                  タグ未設定
                </span>
              )}
            </div>

            <div
              className="mt-0.5 text-[var(--color-text)]/85 tabular-nums"
              style={{ fontFamily: "var(--font-body)", fontSize: 11.5 }}
            >
              <span className="text-[var(--color-muted)]">参考</span>{" "}
              {entry.refPriceMin > 0
                ? `${formatPrice(entry.refPriceMin)}–${formatPrice(entry.refPriceMax || entry.refPriceMin)}`
                : "—"}
              <span className="text-[var(--color-muted)] ml-2">最低</span>{" "}
              {entry.minPrice > 0 ? formatPrice(entry.minPrice) : "—"}
            </div>
          </div>
        </Link>

        <IconButton
          size="sm"
          aria-label="この行を削除"
          onClick={onRemove}
          className="shrink-0"
        >
          <X size={14} />
        </IconButton>
      </div>

      {/* Preset select + status badge — full-width row below the link */}
      <div className="ml-[34px] mt-2 flex items-center gap-2 flex-wrap">
        <label
          className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] shrink-0"
          style={{ fontFamily: "var(--font-label)" }}
        >
          PRESET
        </label>
        <select
          value={entry.presetId ?? ""}
          onChange={(e) => onChangePreset(e.target.value)}
          disabled={processing}
          className="flex-1 min-w-0 h-8 px-2 text-[12px] bg-white border border-[var(--color-line)]"
          style={{ borderRadius: 0, fontFamily: "var(--font-body)" }}
        >
          <option value="">未選択</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {!p.main ? " (メイン無し)" : ""}
            </option>
          ))}
        </select>
      </div>

      {(failed || missing.length > 0 || entry.error) && (
        <div className="ml-[34px] mt-2 flex items-start gap-1.5 text-[11px] text-[var(--color-danger)]">
          <AlertTriangle size={12} className="mt-[2px] shrink-0" />
          <span className="leading-snug">
            {failed
              ? `処理失敗: ${entry.error ?? ""}`
              : entry.error
                ? entry.error
                : `未入力: ${missing.join(" / ")}（行をタップして編集）`}
          </span>
        </div>
      )}
    </div>
  );
}

function PeriodBadgeMini({
  yearMonth,
  phase,
  tier,
}: {
  yearMonth: string;
  phase: "ongoing" | "lastDay";
  tier: 0 | 1 | 2;
}) {
  const styles: Record<number, React.CSSProperties> = {
    0: {
      background: "var(--color-gold)",
      color: "#ffffff",
      border: "1px solid var(--color-gold)",
    },
    1: {
      background: "transparent",
      color: "var(--color-gold-deep)",
      border: "1px solid var(--color-gold-deep)",
    },
    2: {
      background: "transparent",
      color: "var(--color-muted)",
      border: "1px solid var(--color-muted)",
    },
  };
  return (
    <span
      className="shrink-0 inline-flex items-center leading-none whitespace-nowrap"
      style={{
        fontFamily: "var(--font-label)",
        fontSize: 8.5,
        fontWeight: 500,
        letterSpacing: "0.14em",
        padding: "2px 6px",
        borderRadius: 0,
        ...styles[tier],
      }}
    >
      {formatShopPeriod(yearMonth, phase)}
    </span>
  );
}
