"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { latestPriceEntry, type Item, type Tag } from "@/lib/db";
import { formatPrice } from "@/lib/utils/parsePrice";
import { formatShopPeriod, roundAgeIndex } from "@/lib/shopPeriods";
import TagChip from "./TagChip";

/**
 * Period badge color tier — anchored on the primary mint teal for the
 * newest round, then stepping toward less saturated, near-grey teals for
 * older rounds. Lightness stays roughly constant so older tiers look more
 * muted (not brighter), and white text keeps comfortable contrast on every
 * tier.
 */
function periodBadgeClass(yearMonth: string): string {
  const idx = roundAgeIndex(yearMonth);
  if (idx === 0) return "bg-[#65a79d] text-white";
  if (idx === 1) return "bg-[#6f938c] text-white";
  if (idx === 2) return "bg-[#7a8a86] text-white";
  if (idx >= 3) return "bg-[#838786] text-white";
  return "bg-[#838786] text-white";
}

export default function ItemCard({
  item,
  tags,
}: {
  item: Item;
  tags: Tag[];
}) {
  const itemTags = tags.filter((t) => item.tagIds.includes(t.id));
  const thumbSource = item.iconBlob ?? item.mainImageBlob;
  const [thumbUrl, setThumbUrl] = useState<string | undefined>(
    item.driveThumbnailUrl
  );

  useEffect(() => {
    if (!thumbSource) return;
    const url = URL.createObjectURL(thumbSource);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbSource]);

  const latest = latestPriceEntry(item);
  const periodLabel = latest?.shopPeriod
    ? formatShopPeriod(latest.shopPeriod.yearMonth, latest.shopPeriod.phase)
    : null;

  return (
    <Link
      href={`/items/${item.id}`}
      className="flex gap-3 px-2 py-2.5 hover:bg-[var(--color-line-soft)] active:bg-[var(--color-line)] transition-colors"
    >
      <div className="shrink-0 w-[60px] h-[60px] rounded-md bg-white border border-[var(--color-line)] overflow-hidden flex items-center justify-center text-muted">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon size={20} strokeWidth={1.6} />
        )}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-[14px] text-text break-words">
            {item.name || "(名称未設定)"}
          </h3>
          {periodLabel && latest?.shopPeriod && (
            <span
              className={`shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold leading-[14px] tracking-wide ${periodBadgeClass(latest.shopPeriod.yearMonth)}`}
            >
              {periodLabel}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5 tabular-nums whitespace-nowrap">
          <span className="text-[10px] text-muted uppercase tracking-wider">
            ref
          </span>
          <span className="text-[15px] font-bold text-gold-deep">
            {latest
              ? `${formatPrice(latest.refPriceMin)}〜${formatPrice(latest.refPriceMax)}`
              : "—"}
          </span>
          <span className="text-[10px] text-muted">GP</span>
        </div>
        <div className="text-[11px] tabular-nums whitespace-nowrap">
          <span className="text-muted">最低 </span>
          <span className="text-text/70">{formatPrice(item.minPrice)} GP</span>
        </div>
        {(itemTags.length > 0 || latest?.priceSource) && (
          <div className="flex items-center flex-wrap gap-1 mt-1">
            {itemTags.map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
            {latest?.priceSource && (
              <span className="tag-chip bg-sky">{latest.priceSource}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
