"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CalendarDays,
  Pencil,
  Plus,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import {
  db,
  deleteItem,
  deletePriceEntry,
  sortedPriceEntries,
  type Item,
  type PriceEntry,
  type Tag,
} from "@/lib/db";
import { formatPrice } from "@/lib/utils/parsePrice";
import { formatDateTime } from "@/lib/utils/date";
import { formatShopPeriod, roundAgeIndex } from "@/lib/shopPeriods";
import TagChip from "@/components/TagChip";
import { Button, Card, IconButton } from "@/components/ui";

function periodBadgeClass(yearMonth: string): string {
  const idx = roundAgeIndex(yearMonth);
  if (idx === 0) return "bg-[#65a79d] text-white";
  if (idx === 1) return "bg-[#c7e9e3] text-[#5b6e6a]";
  return "bg-[#eef5f1] text-[#9eaeaa]";
}

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const item = useLiveQuery(() => db().items.get(id), [id]);
  const allTags = useLiveQuery(() => db().tags.toArray(), [], [] as Tag[]);

  const iconSrc = item?.iconBlob;
  const mainSrc = item?.mainImageBlob;

  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [mainUrl, setMainUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!iconSrc) return setIconUrl(undefined);
    const url = URL.createObjectURL(iconSrc);
    setIconUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [iconSrc]);

  useEffect(() => {
    if (!mainSrc) return setMainUrl(undefined);
    const url = URL.createObjectURL(mainSrc);
    setMainUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mainSrc]);

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
  const entries = sortedPriceEntries(i);

  const onDelete = async () => {
    if (!confirm(`「${i.name}」を削除しますか？`)) return;
    await deleteItem(i.id);
    router.push("/");
  };

  const onDeleteEntry = async (entryId: string) => {
    if (entries.length <= 1) {
      alert("最後の価格は削除できません。アイテムごと削除してください。");
      return;
    }
    if (!confirm("この価格を削除しますか？")) return;
    try {
      await deletePriceEntry(i.id, entryId);
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  return (
    <div className="pt-3 pb-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-20 h-20 rounded-lg border border-[var(--color-line)] bg-white overflow-hidden flex items-center justify-center">
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt="アイコン" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-muted">no icon</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold text-text leading-snug break-words">
            {i.name}
          </h2>
          {i.category && (
            <div className="text-[12px] text-muted flex items-center gap-1.5 mt-1">
              <TagIcon size={12} strokeWidth={2.2} />
              {i.category}
            </div>
          )}
        </div>
      </div>

      <Card padding="none" className="overflow-hidden">
        {mainUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mainUrl}
            alt={i.name}
            className="w-full max-h-[60vh] object-contain bg-white"
          />
        ) : (
          <div className="aspect-[4/3] flex items-center justify-center text-muted text-[12px]">
            メイン画像が登録されていません
          </div>
        )}
      </Card>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <TagChip key={t.id} tag={t} />
          ))}
        </div>
      )}

      <Card padding="sm">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] text-muted font-medium">
            最低価格
          </span>
          <span className="text-[18px] font-bold text-text tabular-nums">
            {formatPrice(i.minPrice)}{" "}
            <span className="text-[11px] text-muted font-medium">GP</span>
          </span>
        </div>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[13px] font-bold text-text/85">
            マイショップ参考価格 ({entries.length})
          </h3>
          <Link href={`/items/${i.id}/prices/new`}>
            <Button variant="primary" size="sm" icon={<Plus size={14} />}>
              価格を追加
            </Button>
          </Link>
        </div>
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <PriceEntryCard
                entry={entry}
                onEdit={() =>
                  router.push(`/items/${i.id}/prices/${entry.id}/edit`)
                }
                onDelete={() => onDeleteEntry(entry.id)}
                deletable={entries.length > 1}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="text-[11px] text-muted pt-2 border-t border-[var(--color-line)] tabular-nums">
        登録 {formatDateTime(i.createdAt)}
        {i.updatedAt !== i.createdAt && (
          <> / 更新 {formatDateTime(i.updatedAt)}</>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          variant="danger"
          size="lg"
          onClick={onDelete}
          icon={<Trash2 size={15} />}
        >
          削除
        </Button>
        <Link href={`/items/${i.id}/edit`} className="flex-1">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<Pencil size={15} />}
          >
            編集
          </Button>
        </Link>
      </div>
    </div>
  );
}

function PriceEntryCard({
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
  const periodLabel = entry.shopPeriod
    ? formatShopPeriod(entry.shopPeriod.yearMonth, entry.shopPeriod.phase)
    : null;
  return (
    <Card padding="sm">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {periodLabel && entry.shopPeriod ? (
          <span
            className={`shrink-0 px-1.5 py-px rounded-full text-[11px] font-bold leading-[16px] ${periodBadgeClass(entry.shopPeriod.yearMonth)}`}
          >
            {periodLabel}
          </span>
        ) : (
          <span className="text-[11px] text-muted">時期未指定</span>
        )}
        <div className="flex items-center gap-0.5">
          <IconButton size="sm" onClick={onEdit} aria-label="価格を編集">
            <Pencil size={14} />
          </IconButton>
          <IconButton
            size="sm"
            onClick={onDelete}
            disabled={!deletable}
            aria-label="価格を削除"
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      </div>
      <div className="text-[13px] tabular-nums mt-1">
        <span className="text-muted text-[11px] mr-1.5">参考価格</span>
        <span className="font-bold text-gold-deep text-[15px]">
          {formatPrice(entry.refPriceMin)}〜{formatPrice(entry.refPriceMax)}
        </span>
        <span className="text-[10px] text-muted ml-1">GP</span>
      </div>
      {entry.priceSource && (
        <div className="text-[11px] text-muted flex items-center gap-1.5 mt-1">
          情報元
          <span className="tag-chip bg-sky">{entry.priceSource}</span>
        </div>
      )}
      <div className="text-[10.5px] text-muted flex items-center gap-1 pt-1">
        <CalendarDays size={11} strokeWidth={2.2} />
        確認 {formatDateTime(entry.checkedAt)}
      </div>
    </Card>
  );
}
