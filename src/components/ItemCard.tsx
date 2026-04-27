"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ImageIcon } from "lucide-react";
import type { Item, Tag } from "@/lib/db";
import { formatPrice } from "@/lib/utils/parsePrice";
import TagChip from "./TagChip";

function formatDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
      className="block rounded-2xl bg-cream border border-beige hover:border-gold/50 active:border-gold transition-colors shadow-[0_2px_8px_-4px_rgba(168,136,66,0.18)] overflow-hidden"
    >
      <div className="flex gap-3 p-3">
        <div className="shrink-0 w-20 h-20 rounded-xl bg-beige/70 border border-beige overflow-hidden flex items-center justify-center text-muted">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon size={28} strokeWidth={1.6} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-bold text-[15px] text-text truncate">
              {item.name || "(名称未設定)"}
            </h3>
          </div>
          {item.category && (
            <div className="text-[11px] text-muted mt-0.5">
              🏷 {item.category}
            </div>
          )}
          <div className="text-[13px] text-text/90 mt-1.5 leading-snug">
            <span className="font-semibold text-gold-deep">
              {formatPrice(item.minPrice)}GP
            </span>
            <span className="text-muted mx-1.5">/</span>
            <span>
              {formatPrice(item.refPriceMin)}〜{formatPrice(item.refPriceMax)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1.5 gap-2">
            <div className="flex items-center gap-1 text-[11px] text-muted whitespace-nowrap shrink-0">
              <CalendarDays size={12} />
              <span>{formatDate(item.checkedAt)}</span>
            </div>
            <div className="flex items-center gap-1 overflow-hidden min-w-0">
              {itemTags.slice(0, 2).map((t) => (
                <TagChip key={t.id} tag={t} />
              ))}
              {itemTags.length > 2 && (
                <span className="text-[11px] text-muted shrink-0">
                  +{itemTags.length - 2}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
