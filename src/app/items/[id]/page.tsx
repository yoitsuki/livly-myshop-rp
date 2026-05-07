"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Calendar, ImageIcon } from "lucide-react";
import { useItem, useTags } from "@/lib/firebase/hooks";
import {
  infoSourceLabel,
  sortedPriceEntries,
  type Item,
  type PriceEntry,
} from "@/lib/firebase/repo";
import { formatPrice } from "@/lib/utils/parsePrice";
import { formatDateTime } from "@/lib/utils/date";
import { formatShopPeriod, roundAgeIndex } from "@/lib/shopPeriods";
import TagChip from "@/components/TagChip";
import InfoSourceChip from "@/components/InfoSourceChip";
import { useAuth } from "@/lib/firebase/auth";

// Admin-only buttons + ConfirmDialog + write helpers (deleteItem /
// deletePriceEntry) live in this dynamically loaded chunk so the
// non-admin bundle has no path to invoke writes.
const ItemAdminActions = dynamic(() => import("@/components/ItemAdminActions"), {
  ssr: false,
});

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
        padding: "2px 5px",
        fontFamily: "var(--font-label)",
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: "0.08em",
        borderRadius: 0,
        ...tierStyle[tier],
      }}
    >
      {label}
    </span>
  );
}

/** Small Atelier corner-tick thumb for the title block (viewer parity). */
function AtelierThumb({
  src,
  alt,
  size,
}: {
  src?: string;
  alt: string;
  size: number;
}) {
  return (
    <div
      className="atelier-thumb shrink-0"
      style={{ width: size, height: size }}
    >
      <div className="atelier-thumb-inner w-full h-full flex items-center justify-center text-[var(--color-muted)]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={size > 60 ? 22 : 18} strokeWidth={1.4} />
        )}
      </div>
      <span className="atelier-tick atelier-tick--tl" aria-hidden />
      <span className="atelier-tick atelier-tick--tr" aria-hidden />
      <span className="atelier-tick atelier-tick--bl" aria-hidden />
      <span className="atelier-tick atelier-tick--br" aria-hidden />
    </div>
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
  const item = useItem(id);
  const allTags = useTags() ?? [];
  const { isAdmin } = useAuth();

  // 詳細ページは常に先頭から読みたい。 単発の scrollTo(0, 0) では
  // (1) ブラウザの自動 scroll restoration が後発で前回の scrollY を
  //     復元するケース、
  // (2) Firestore の useItem(id) 初回 undefined → データ到着で
  //     placeholder から本文に化け、 ページが伸びた直後の位置ズレ、
  // を取り切れず「時を刻まない時計」のような長尺 item で先頭に
  // 戻らない事象があった ( v0.27.5 → v0.27.6 ) 。 [id] mount 時に
  // 直ちに + 次フレームで scrollTo を 2 度打ち、 さらに item が
  // undefined → 本物に切り替わった瞬間にも一度だけ top に戻す。
  const initialScrollDoneRef = useRef(false);
  useEffect(() => {
    initialScrollDoneRef.current = false;
    window.scrollTo(0, 0);
    const raf = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(raf);
  }, [id]);
  useEffect(() => {
    if (item !== undefined && !initialScrollDoneRef.current) {
      window.scrollTo(0, 0);
      initialScrollDoneRef.current = true;
    }
  }, [item]);

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

  return (
    <div className="pb-8">

      {/* ── Top action: EDIT (admin-only) ────────────────────────── */}
      {isAdmin && (
        <div className="pt-3">
          <ItemAdminActions kind="topEdit" id={i.id} />
        </div>
      )}

      {/* ── Title block ──────────────────────────────────────────── */}
      <div className="pt-4 pb-3 flex gap-3.5">
        <AtelierThumb src={i.iconUrl} alt={i.name} size={64} />
        <div className="flex-1 min-w-0">
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
      </div>

      {/* ── Tags + 情報元 ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-[5px] mb-4">
        {tags.map((t) => (
          <TagChip key={t.id} tag={t} />
        ))}
        <InfoSourceChip label={infoSourceLabel(i)} />
      </div>

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
          {isAdmin && <ItemAdminActions kind="addPrice" id={i.id} />}
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
                actions={
                  isAdmin ? (
                    <ItemAdminActions
                      kind="entryActions"
                      itemId={i.id}
                      entryId={entry.id}
                      deletable={entries.length > 1}
                    />
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      </div>

      {/* ── Hero image (supplementary, below market reference) ─── */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[var(--color-muted)]"
            style={{ fontFamily: "var(--font-label)", fontSize: 9.5, letterSpacing: "0.18em" }}
          >
            マイショップ画像
          </span>
          <span className="h-px flex-1 bg-[var(--color-line)]" aria-hidden />
        </div>
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

      {/* ── Bottom action: DELETE (admin-only) ───────────────────── */}
      {isAdmin && (
        <div className="flex mt-4">
          <ItemAdminActions kind="bottomDelete" item={i} />
        </div>
      )}
    </div>
  );
}

function PriceEntryRow({
  entry,
  actions,
}: {
  entry: PriceEntry;
  actions?: React.ReactNode;
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
        {actions ? (
          <div className="flex items-center gap-0.5 shrink-0 self-start">
            {actions}
          </div>
        ) : null}
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
