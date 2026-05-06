"use client";

import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { latestPriceEntry, type Item, type Tag } from "@/lib/firebase/repo";
import { formatPrice } from "@/lib/utils/parsePrice";
import { formatShopPeriod, roundAgeIndex } from "@/lib/shopPeriods";
import TagChip from "./TagChip";

/** Atelier period badge — 3 tiers based on round age. */
function PeriodBadge({ yearMonth, phase }: { yearMonth: string; phase: string }) {
  const idx = roundAgeIndex(yearMonth);
  const tier = idx <= 0 ? 0 : idx === 1 ? 1 : 2;
  const label = formatShopPeriod(yearMonth, phase as "ongoing" | "lastDay");

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
      className="shrink-0 inline-flex items-center px-2 leading-none whitespace-nowrap"
      style={{
        fontFamily: "var(--font-label)",
        fontSize: 9.5,
        fontWeight: 500,
        letterSpacing: "0.16em",
        padding: "2px 8px",
        borderRadius: 0,
        ...styles[tier],
      }}
    >
      {label}
    </span>
  );
}

/** Thumb with Atelier corner-tick frame */
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

export default function ItemCard({
  item,
  tags,
}: {
  item: Item;
  tags: Tag[];
}) {
  const itemTags = tags.filter((t) => item.tagIds.includes(t.id));
  const thumbUrl = item.iconUrl ?? item.mainImageUrl;
  const latest = latestPriceEntry(item);

  return (
    <Link
      href={`/items/${item.id}`}
      className="atelier-row flex gap-3.5 px-3.5 pt-4 pb-4 border-t border-[var(--color-line)] bg-white"
    >
      <AtelierThumb src={thumbUrl} alt={item.name} size={64} />

      <div className="min-w-0 flex-1" style={{ paddingTop: 1 }}>
        {/* item name — Cormorant serif (+ REPLICA badge for replicas) */}
        <div className="flex items-start gap-2">
          <h3
            className="flex-1 min-w-0 text-[var(--color-text)] leading-snug break-words"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              fontWeight: 400,
              letterSpacing: "0.02em",
              margin: 0,
            }}
          >
            {item.name || "(名称未設定)"}
          </h3>
          {item.isReplica && (
            <span
              className="shrink-0 inline-flex items-center mt-[3px]"
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 8.5,
                fontWeight: 500,
                letterSpacing: "0.22em",
                padding: "1px 5px",
                borderRadius: 0,
                background: "transparent",
                color: "var(--color-gold-deep)",
                border: "1px solid var(--color-gold-deep)",
              }}
            >
              REPLICA
            </span>
          )}
        </div>

        {/* 参考価格 + period badge */}
        <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-1 mt-[7px]">
          <span
            className="text-[var(--color-muted)]"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              letterSpacing: "0.04em",
            }}
          >
            参考価格
          </span>
          <span
            className="text-[var(--color-gold-deep)] tabular-nums"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "0.01em",
            }}
          >
            {latest
              ? `${formatPrice(latest.refPriceMin)}–${formatPrice(latest.refPriceMax)}`
              : "—"}
          </span>
          <span
            className="text-[var(--color-muted)]"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 9,
              letterSpacing: "0.18em",
            }}
          >
            GP
          </span>
          {latest?.shopPeriod && (
            <span className="ml-auto self-center">
              <PeriodBadge
                yearMonth={latest.shopPeriod.yearMonth}
                phase={latest.shopPeriod.phase}
              />
            </span>
          )}
        </div>

        {/* 最低価格 */}
        <div
          className="text-[var(--color-muted)] mt-px tabular-nums"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 11,
            letterSpacing: "0.04em",
          }}
        >
          <span>最低価格</span>{" "}
          {formatPrice(item.minPrice)} GP
        </div>

        {/* tags */}
        {itemTags.length > 0 && (
          <div className="flex items-center flex-wrap gap-[5px] mt-[7px]">
            {itemTags.map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
