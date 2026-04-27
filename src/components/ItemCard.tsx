"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImageIcon, Tag as TagIcon, CalendarDays } from "lucide-react";
import type { Item, Tag } from "@/lib/db";
import { formatPrice } from "@/lib/utils/parsePrice";
import TagChip from "./TagChip";

function formatDate(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function ItemCard({
  item,
  tags,
}: {
  item: Item;
  tags: Tag[];
}) {
  const itemTags = tags.filter((t) => item.tagIds.includes(t.id));
  const [thumbUrl, setThumbUrl] = useState<string | undefined>(
    item.driveThumbnailUrl
  );

  useEffect(() => {
    if (!item.thumbBlob) return;
    const url = URL.createObjectURL(item.thumbBlob);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item.thumbBlob]);

  return (
    <Link
      href={`/items/${item.id}`}
      className="flex gap-2.5 px-2 py-2 hover:bg-beige/40 active:bg-beige/60 transition-colors"
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
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-bold text-[14px] text-text truncate">
            {item.name || "(名称未設定)"}
          </h3>
          <span className="shrink-0 font-bold text-[13px] text-gold-deep whitespace-nowrap tabular-nums">
            {formatPrice(item.refPriceMin)}〜{formatPrice(item.refPriceMax)}
            <span className="text-[11px] font-medium ml-0.5">GP</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-[11px] mt-0.5">
          <div className="text-muted truncate flex items-center gap-1">
            {item.category && (
              <>
                <TagIcon size={11} strokeWidth={2.2} className="shrink-0" />
                <span className="truncate">{item.category}</span>
                <span className="mx-0.5">·</span>
              </>
            )}
            <CalendarDays size={11} strokeWidth={2.2} className="shrink-0" />
            <span className="whitespace-nowrap">{formatDate(item.checkedAt)}</span>
          </div>
          <span className="shrink-0 text-text/65 tabular-nums whitespace-nowrap">
            / {formatPrice(item.minPrice)} GP
          </span>
        </div>
        {(itemTags.length > 0 || item.description) && (
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            {itemTags.slice(0, 3).map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
            {itemTags.length > 3 && (
              <span className="text-[10px] text-muted shrink-0">
                +{itemTags.length - 3}
              </span>
            )}
            {item.description && (
              <span className="text-[11px] text-muted truncate min-w-0">
                {item.description}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
