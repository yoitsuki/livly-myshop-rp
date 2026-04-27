"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, Pencil, Tag as TagIcon, Trash2 } from "lucide-react";
import { db, deleteItem, type Item, type Tag } from "@/lib/db";
import { formatPrice } from "@/lib/utils/parsePrice";
import { formatDateTime } from "@/lib/utils/date";
import TagChip from "@/components/TagChip";

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const item = useLiveQuery(() => db().items.get(id), [id]);
  const allTags = useLiveQuery(() => db().tags.toArray(), [], [] as Tag[]);
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  useEffect(() => {
    const blob = item?.imageBlob ?? item?.thumbBlob;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item?.imageBlob, item?.thumbBlob]);

  if (item === undefined) {
    return <div className="pt-6 text-center text-muted">読み込み中…</div>;
  }
  if (item === null) {
    return (
      <div className="pt-6 text-center text-muted">
        アイテムが見つかりませんでした。
        <div className="mt-3">
          <Link href="/" className="text-gold-deep underline">
            ホームへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const i = item as Item;
  const tags = allTags.filter((t) => i.tagIds.includes(t.id));

  const onDelete = async () => {
    if (!confirm(`「${i.name}」を削除しますか？`)) return;
    await deleteItem(i.id);
    router.push("/");
  };

  return (
    <div className="pt-3 pb-6 space-y-4">
      <div className="rounded-2xl border border-beige bg-white overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={i.name}
            className="w-full max-h-[60vh] object-contain bg-white"
          />
        ) : (
          <div className="aspect-[3/4] bg-beige/40" />
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-[18px] font-bold text-text leading-snug">{i.name}</h2>
        {i.category && (
          <div className="text-[13px] text-muted flex items-center gap-1.5">
            <TagIcon size={13} strokeWidth={2.2} />
            {i.category}
          </div>
        )}
        <div className="text-[15px]">
          <span className="font-bold text-gold-deep tabular-nums">
            {formatPrice(i.refPriceMin)}〜{formatPrice(i.refPriceMax)} GP
          </span>
          <span className="text-muted text-[12px] mx-2">参考価格</span>
        </div>
        <div className="text-[14px] text-text/80">
          <span className="tabular-nums">{formatPrice(i.minPrice)} GP</span>
          <span className="text-muted text-[12px] ml-2">最低販売価格</span>
        </div>
        {i.description && (
          <p className="text-[13px] text-text/80 whitespace-pre-wrap leading-relaxed pt-1">
            {i.description}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tags.map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
          </div>
        )}
        <div className="text-[12px] text-muted flex items-center gap-1.5 pt-2 border-t border-beige/50">
          <CalendarDays size={12} strokeWidth={2.2} />
          確認日時 {formatDateTime(i.checkedAt)}
        </div>
        <div className="text-[11px] text-muted">
          登録 {formatDateTime(i.createdAt)}
          {i.updatedAt !== i.createdAt && (
            <> / 更新 {formatDateTime(i.updatedAt)}</>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onDelete}
          className="px-4 py-2.5 rounded-full bg-pink/40 text-text/80 font-bold flex items-center gap-1.5"
        >
          <Trash2 size={15} />
          削除
        </button>
        <Link
          href={`/items/${i.id}/edit`}
          className="flex-1 py-2.5 rounded-full bg-gold text-white font-bold text-center flex items-center justify-center gap-1.5"
        >
          <Pencil size={15} />
          編集
        </Link>
      </div>
    </div>
  );
}
