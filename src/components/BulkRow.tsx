"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { bulkEntryMissingFields, type BulkEntry } from "@/lib/bulk/types";
import type { CropPreset } from "@/lib/preset";
import type { Item } from "@/lib/firebase/types";
import { formatShopPeriod, roundAgeIndex } from "@/lib/shopPeriods";
import { formatPrice } from "@/lib/utils/parsePrice";
import { IconButton } from "@/components/ui";

export interface BulkRowProps {
  entry: BulkEntry;
  presets: CropPreset[];
  /** Optional href for tap-to-deep-edit. Inbox v1 omits this. */
  editHref?: string;
  onToggleCheck: (next: boolean) => void;
  onChangePreset: (presetId: string) => void;
  onRemove: () => void;
  /** When set, the row is locked (already saved) and gets a 登録済み badge. */
  savedAt?: number;
  /** Snapshot of all items so the row can soften the missing-field
   *  validation when this entry will merge into an existing same-name item
   *  ( v0.27.4 ) . */
  allItems?: Item[];
}

export default function BulkRow({
  entry,
  presets,
  editHref,
  onToggleCheck,
  onChangePreset,
  onRemove,
  savedAt,
  allItems,
}: BulkRowProps) {
  const missing = bulkEntryMissingFields(entry, allItems);
  const processing = entry.status === "processing";
  const failed = entry.status === "failed";
  const saved = savedAt !== undefined;
  // saved ( inbox の "登録済み" ) は badge を残しつつブロックは外す。
  // 同一画像から複数アイテムを切り出すケースのため、再 check / preset
  // 変更 / 再登録を許容する ( inbox の onSave 側も savedAt フィルタを
  // 外して同じ前提で動く ) 。
  const checkboxDisabled = processing || failed || missing.length > 0;

  const periodTier = entry.shopPeriod
    ? roundAgeIndex(entry.shopPeriod.yearMonth)
    : null;

  const summary = (
    <>
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
          {editHref && (
            <ChevronRight
              size={16}
              strokeWidth={1.6}
              className="text-[var(--color-muted)] shrink-0 mt-1"
            />
          )}
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
          {saved && <SavedBadge />}
          {!saved && entry.status === "ready" && entry.tagIds.length === 0 && (
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
          {entry.isReplica === true && <ReplicaBadge />}
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
    </>
  );

  return (
    <div className="px-2 py-3 border-b border-[var(--color-line)] bg-white">
      <div className="flex gap-2.5">
        <div className="shrink-0 pt-1">
          <input
            type="checkbox"
            checked={entry.checked}
            disabled={checkboxDisabled}
            onChange={(e) => onToggleCheck(e.target.checked)}
            aria-label="登録対象に含める"
            className="w-5 h-5 accent-[var(--color-gold-deep)] disabled:opacity-30"
          />
        </div>

        {editHref ? (
          <Link href={editHref} className="flex-1 min-w-0 flex gap-2.5">
            {summary}
          </Link>
        ) : (
          <div className="flex-1 min-w-0 flex gap-2.5">{summary}</div>
        )}

        <IconButton
          size="sm"
          aria-label="この行を削除"
          onClick={onRemove}
          className="shrink-0"
        >
          <X size={14} />
        </IconButton>
      </div>

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
          className="flex-1 min-w-0 h-8 px-2 text-[12px] bg-white border border-[var(--color-line)] disabled:opacity-50"
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

      {(failed ||
        (!processing && !saved && missing.length > 0) ||
        entry.error) && (
        <div className="ml-[34px] mt-2 flex items-start gap-1.5 text-[11px] text-[var(--color-danger)]">
          <AlertTriangle size={12} className="mt-[2px] shrink-0" />
          <span className="leading-snug">
            {failed
              ? `処理失敗: ${entry.error ?? ""}`
              : entry.error
                ? entry.error
                : `未入力: ${missing.join(" / ")}${editHref ? "（行をタップして編集）" : ""}`}
          </span>
        </div>
      )}
    </div>
  );
}

function SavedBadge() {
  return (
    <span
      className="shrink-0 inline-flex items-center gap-0.5 leading-none whitespace-nowrap"
      style={{
        fontFamily: "var(--font-label)",
        fontSize: 8.5,
        fontWeight: 500,
        letterSpacing: "0.14em",
        padding: "2px 6px",
        borderRadius: 0,
        background: "var(--color-gold-deep)",
        color: "#fff",
        border: "1px solid var(--color-gold-deep)",
      }}
    >
      <Check size={9} strokeWidth={2.4} />
      登録済み
    </span>
  );
}

function ReplicaBadge() {
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
        background: "transparent",
        color: "var(--color-gold-deep)",
        border: "1px solid var(--color-gold-deep)",
      }}
    >
      レプリカ
    </span>
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
