"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useItem, useTags } from "@/lib/firebase/hooks";
import {
  deleteItem,
  deletePriceEntry,
  sortedPriceEntries,
  type Item,
  type PriceEntry,
} from "@/lib/firebase/repo";
import { formatPrice } from "@/lib/utils/parsePrice";
import { formatDateTime } from "@/lib/utils/date";
import { formatShopPeriod, roundAgeIndex } from "@/lib/shopPeriods";
import TagChip from "@/components/TagChip";
import { ConfirmDialog } from "@/components/ui";

/** Atelier period badge */
function PeriodBadge({ yearMonth, phase }: { yearMonth: string; phase: string }) {
  const idx = roundAgeIndex(yearMonth);
  const tier = idx <= 0 ? 0 : idx === 1 ? 1 : 2;
  const label = formatShopPeriod(yearMonth, phase as "ongoing" | "lastDay");

  const tierStyle: React.CSSProperties[] = [
    { background: "var(--color-gold)", color: "#fff", border: "1px solid var(--color-gold)" },
    { background: "transparent", color: "var(--color-gold-deep)", border: "1px solid var(--color-gold-deep)" },
    { background: "transparent", color: "var(--color-muted)", border: "1px solid var(--color-muted)" },
  ];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        fontFamily: "var(--font-label)",
        fontSize: 9.5,
        fontWeight: 500,
        letterSpacing: "0.16em",
        borderRadius: 0,
        ...tierStyle[tier],
      }}
    >
      {label}
    </span>
  );
}

/** Atelier hero image: full-width square with corner ticks */
function AtelierHero({ src, alt }: { src?: string; alt: string }) {
  return (
    <div
      className="atelier-thumb w-full"
      style={{ aspectRatio: "1 / 1", padding: 6 }}
    >
      <div
        className="atelier-thumb-inner w-full h-full flex items-center justify-center text-[var(--color-muted)] bg-[var(--color-line-soft)]"
        style={{ fontSize: 12 }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="w-full h-full object-contain bg-white" />
        ) : (
          <span>画像が登録されていません</span>
        )}
      </div>
      <span className="atelier-tick atelier-tick--tl" aria-hidden />
      <span className="atelier-tick atelier-tick--tr" aria-hidden />
      <span className="atelier-tick atelier-tick--bl" aria-hidden />
      <span className="atelier-tick atelier-tick--br" aria-hidden />
    </div>
  );
}

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const item = useItem(id);
  const allTags = useTags() ?? [];

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const mainUrl = item?.mainImageUrl;

  if (item === undefined) {
    return (
      <div
        className="pt-6 text-center text-[var(--color-muted)]"
        style={{ fontFamily: "var(--font-label)", fontSize: 12, letterSpacing: "0.12em" }}
      >
        読み込み中…
      </div>
    );
  }
  if (item === null) {
    return (
      <div className="pt-6 text-center text-[var(--color-muted)]">
        アイテムが見つかりませんでした。
        <div className="mt-3">
          <Link href="/" className="text-[var(--color-gold-deep)] underline">
            ホームへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const i = item as Item;
  const tags = allTags.filter((t) => i.tagIds.includes(t.id));
  const entries = sortedPriceEntries(i);

  const onDelete = () => {
    setConfirmDialog({
      message: `「${i.name}」を削除しますか？\nこの操作は取り消せません。`,
      onConfirm: async () => {
        await deleteItem(i.id);
        router.push("/");
      },
    });
  };

  const onDeleteEntry = (entryId: string) => {
    if (entries.length <= 1) {
      alert("最後の価格は削除できません。アイテムごと削除してください。");
      return;
    }
    setConfirmDialog({
      message: "この価格を削除しますか？",
      onConfirm: async () => {
        try {
          await deletePriceEntry(i.id, entryId);
        } catch (e) {
          alert(e instanceof Error ? e.message : "削除に失敗しました");
        }
      },
    });
  };

  return (
    <div className="pb-8">

      {/* ── Top action: EDIT (full width) ────────────────────────── */}
      <div className="pt-3">
        <Link
          href={`/items/${i.id}/edit`}
          className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 bg-[var(--color-gold-deep)] text-white hover:bg-gold transition-colors"
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: "0.24em",
            borderRadius: 0,
          }}
        >
          <Pencil size={13} strokeWidth={1.8} />
          EDIT
        </Link>
      </div>

      {/* ── Title block ──────────────────────────────────────────── */}
      <div className="pt-4 pb-3">
        {/* category + (optional) REPLICA badge — right-aligned, no rule */}
        {(i.category || i.isReplica) && (
          <div className="flex justify-end items-center gap-2 mb-2">
            {i.isReplica && (
              <span
                className="inline-flex items-center"
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 9.5,
                  fontWeight: 500,
                  letterSpacing: "0.22em",
                  padding: "2px 7px",
                  borderRadius: 0,
                  background: "transparent",
                  color: "var(--color-gold-deep)",
                  border: "1px solid var(--color-gold-deep)",
                }}
              >
                REPLICA
              </span>
            )}
            {i.category && (
              <span
                className="text-[var(--color-muted)]"
                style={{ fontFamily: "var(--font-label)", fontSize: 9.5, letterSpacing: "0.18em" }}
              >
                {i.category}
              </span>
            )}
          </div>
        )}
        {/* item name */}
        <h2
          className="text-[var(--color-text)] leading-snug break-words"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: "0.02em",
            margin: 0,
          }}
        >
          {i.name}
        </h2>
      </div>

      {/* ── Tags ─────────────────────────────────────────────────── */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-[5px] mb-4">
          {tags.map((t) => (
            <TagChip key={t.id} tag={t} />
          ))}
        </div>
      )}

      {/* ── MIN PRICE bar ────────────────────────────────────────── */}
      <div className="flex items-center py-3">
        <span
          className="text-[var(--color-muted)] flex-1 uppercase"
          style={{ fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.28em" }}
        >
          MIN PRICE
        </span>
        <span
          className="w-px h-3 bg-[var(--color-line)] mx-4 shrink-0"
          aria-hidden
        />
        <span
          className="text-[var(--color-gold-deep)] tabular-nums"
          style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500 }}
        >
          {formatPrice(i.minPrice)}
        </span>
        <span
          className="text-[var(--color-muted)] ml-1.5"
          style={{ fontFamily: "var(--font-label)", fontSize: 9.5, letterSpacing: "0.18em" }}
        >
          GP
        </span>
      </div>

      {/* ── MARKET REFERENCE section ──────────────────────────────── */}
      <div className="mt-6">
        {/* section header */}
        <div className="flex items-center gap-2 mb-0">
          <span
            className="text-[var(--color-muted)] uppercase"
            style={{ fontFamily: "var(--font-label)", fontSize: 9.5, letterSpacing: "0.18em" }}
          >
            MARKET REFERENCE ({entries.length})
          </span>
          <span className="h-px flex-1 bg-[var(--color-line)]" aria-hidden />
          <Link
            href={`/items/${i.id}/prices/new`}
            className="shrink-0 flex items-center gap-1 text-[var(--color-gold-deep)] hover:bg-[var(--color-line-soft)] transition-colors px-2 py-1"
            style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.24em" }}
          >
            <Plus size={11} strokeWidth={2} />
            ADD
          </Link>
        </div>

        {/* price entries */}
        <ul>
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="border-t border-[var(--color-line)] first:border-t-0 py-3"
            >
              <PriceEntryRow
                entry={entry}
                onEdit={() => router.push(`/items/${i.id}/prices/${entry.id}/edit`)}
                onDelete={() => onDeleteEntry(entry.id)}
                deletable={entries.length > 1}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* ── Hero image (supplementary, below market reference) ─── */}
      <div className="mt-6">
        <AtelierHero src={mainUrl} alt={i.name} />
      </div>

      {/* ── Metadata ─────────────────────────────────────────────── */}
      <div
        className="mt-4 pt-3 border-t border-[var(--color-line)] text-[var(--color-muted)] tabular-nums"
        style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.08em" }}
      >
        登録 {formatDateTime(i.createdAt)}
        {i.updatedAt !== i.createdAt && (
          <> / 更新 {formatDateTime(i.updatedAt)}</>
        )}
      </div>

      {/* ── Bottom action: DELETE only ───────────────────────────── */}
      <div className="flex mt-4">
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-[var(--color-muted)] text-[var(--color-muted)] hover:bg-[var(--color-line-soft)] transition-colors"
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: "0.24em",
            borderRadius: 0,
          }}
        >
          <Trash2 size={13} strokeWidth={1.8} />
          DELETE
        </button>
      </div>

      <ConfirmDialog
        open={confirmDialog !== null}
        message={confirmDialog?.message ?? ""}
        onConfirm={async () => {
          await confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}

function PriceEntryRow({
  entry,
  onEdit,
  onDelete,
  deletable,
}: {
  entry: PriceEntry;
  onEdit: () => void;
  onDelete: () => void;
  deletable: boolean;
}) {
  const hasPeriod = !!entry.shopPeriod;

  return (
    <div>
      {/* top row: period badge + ref price + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5 flex-wrap min-w-0">
          {hasPeriod ? (
            <PeriodBadge
              yearMonth={entry.shopPeriod!.yearMonth}
              phase={entry.shopPeriod!.phase}
            />
          ) : (
            <span
              className="text-[var(--color-muted)]"
              style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.08em" }}
            >
              時期未指定
            </span>
          )}
          <span className="flex items-baseline gap-1.5">
            <span
              className="text-[var(--color-gold-deep)] tabular-nums"
              style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500 }}
            >
              {formatPrice(entry.refPriceMin)}–{formatPrice(entry.refPriceMax)}
            </span>
            <span
              className="text-[var(--color-muted)]"
              style={{ fontFamily: "var(--font-label)", fontSize: 9.5, letterSpacing: "0.18em" }}
            >
              GP
            </span>
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 self-start">
          <button
            type="button"
            onClick={onEdit}
            aria-label="価格を編集"
            className="w-[26px] h-[26px] flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-line-soft)] hover:text-[var(--color-text)] transition-colors"
          >
            <Pencil size={13} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!deletable}
            aria-label="価格を削除"
            className="w-[26px] h-[26px] flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-line-soft)] hover:text-[var(--color-text)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={13} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* meta: date + source */}
      <div
        className="flex items-center gap-1.5 mt-1.5 text-[var(--color-muted)]"
        style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.08em" }}
      >
        <Calendar size={11} strokeWidth={1.8} />
        {formatDateTime(entry.checkedAt)}
        {entry.priceSource && (
          <>
            <span className="mx-1 opacity-40">|</span>
            {entry.priceSource}
          </>
        )}
      </div>
    </div>
  );
}
