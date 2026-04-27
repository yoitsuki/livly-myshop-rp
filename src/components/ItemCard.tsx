"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import type { Item, Tag } from "@/lib/db";
import { formatPrice } from "@/lib/utils/parsePrice";
import TagChip from "./TagChip";

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
        <div className="whitespace-nowrap text-[12px]">
          <span className="text-gold-deep tabular-nums">
            {formatPrice(item.refPriceMin)}〜{formatPrice(item.refPriceMax)}
            <span className="text-[10px] ml-0.5">GP</span>
          </span>
          <span className="text-muted mx-1">/</span>
          <span className="text-text/65 tabular-nums">
            {formatPrice(item.minPrice)}
            <span className="text-[10px] ml-0.5">GP</span>
          </span>
        </div>
        {itemTags.length > 0 && (
          <div className="flex items-center flex-wrap gap-0.5">
            {itemTags.map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
