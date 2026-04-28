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
 * muted (not brighter), and white text keeps comfortable contrast on every tier.
 *   index 0 (newest)     → vivid primary teal (#65a79d)
 *   index 1 (one before) → muted teal
 *   index 2              → faded teal
 *   index 3 and older    → near-grey teal
 *   unknown              → near-grey teal (same as oldest tier)
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
      className="flex gap-2.5 px-2 py-1 hover:bg-beige/40 active:bg-beige/60 transition-colors"
    >
      <div className="shrink-0 w-14 h-14 rounded-lg bg-beige/60 border border-beige overflow-hidden flex items-center justify-center text-muted">
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
        <h3 className="font-bold text-[14px] text-text break-words">
          {item.name || "(名称未設定)"}
        </h3>
        <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums whitespace-nowrap">
          <div>
            <span className="text-muted">参考価格 </span>
            <span className="text-gold-deep">
              {latest
                ? `${formatPrice(latest.refPriceMin)}〜${formatPrice(latest.refPriceMax)} GP`
                : "—"}
            </span>
          </div>
          {periodLabel && latest?.shopPeriod && (
            <span
              className={`shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold leading-[14px] ${periodBadgeClass(latest.shopPeriod.yearMonth)}`}
            >
              {periodLabel}
            </span>
          )}
        </div>
        <div className="text-[11px] tabular-nums whitespace-nowrap">
          <span className="text-muted">最低販売価格 </span>
          <span className="text-text/70">{formatPrice(item.minPrice)} GP</span>
        </div>
        {(itemTags.length > 0 || latest?.priceSource) && (
          <div className="flex items-center flex-wrap gap-0.5 mt-px">
            {itemTags.map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
            {latest?.priceSource && (
              <span className="px-1.5 py-px rounded-full text-[10.5px] leading-[15px] font-medium text-text/85 bg-sky whitespace-nowrap">
                {latest.priceSource}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
