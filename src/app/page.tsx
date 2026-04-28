"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, latestPriceEntry, type Item } from "@/lib/db";
import SearchBar from "@/components/SearchBar";
import ItemCard from "@/components/ItemCard";
import Fab from "@/components/Fab";
import { ImageOff, ListFilter } from "lucide-react";

type SortKey = "checkedAt" | "createdAt" | "price";

export default function Home() {
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("checkedAt");

  const items = useLiveQuery(() => db().items.toArray(), [], [] as Item[]);
  const tags = useLiveQuery(() => db().tags.toArray(), [], []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items?.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((i) =>
        [i.name, i.category].join(" ").toLowerCase().includes(needle)
      );
    }
    if (activeCategory) {
      list = list.filter((i) => i.category === activeCategory);
    }
    if (activeTagIds.length > 0) {
      list = list.filter((i) => activeTagIds.every((t) => i.tagIds.includes(t)));
    }
    const sorted = [...list];
    // Sort by the latest price entry's checkedAt / refPriceMin so the home
    // list always reflects the freshest observation per item.
    if (sort === "checkedAt") {
      sorted.sort(
        (a, b) =>
          (latestPriceEntry(b)?.checkedAt ?? 0) -
          (latestPriceEntry(a)?.checkedAt ?? 0)
      );
    } else if (sort === "createdAt") {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      sorted.sort(
        (a, b) =>
          (latestPriceEntry(a)?.refPriceMin ?? Number.POSITIVE_INFINITY) -
          (latestPriceEntry(b)?.refPriceMin ?? Number.POSITIVE_INFINITY)
      );
    }
    return sorted;
  }, [items, q, activeCategory, activeTagIds, sort]);

  const totalCount = items?.length ?? 0;

  return (
    <div className="space-y-3 pt-3">
      <SearchBar value={q} onChange={setQ} />

      {(categories.length > 0 || (tags?.length ?? 0) > 0) && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          <CategoryChip
            label="すべて"
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              active={activeCategory === c}
              onClick={() => setActiveCategory(c)}
            />
          ))}
        </div>
      )}

      {tags && tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {tags.map((t) => {
            const on = activeTagIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() =>
                  setActiveTagIds((prev) =>
                    on ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                  )
                }
                className={`px-2.5 py-1 rounded-full text-[12px] border transition-colors ${
                  on
                    ? "bg-gold/20 border-gold/60 text-gold-deep font-bold"
                    : "bg-cream border-beige text-text/80 hover:border-gold/40"
                }`}
              >
                #{t.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-[12px] text-muted px-1 pt-1">
        <span>{filtered.length} 件 / 全 {totalCount} 件</span>
        <label className="flex items-center gap-1">
          <ListFilter size={14} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-transparent outline-none border-none text-text/80"
          >
            <option value="checkedAt">確認日時順</option>
            <option value="createdAt">登録日順</option>
            <option value="price">参考価格順</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasItems={totalCount > 0} />
      ) : (
        <ul className="divide-y divide-beige/70 -mx-2">
          {filtered.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} tags={tags ?? []} />
            </li>
          ))}
        </ul>
      )}

      <Fab href="/register" />
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] border transition-colors ${
        active
          ? "bg-gold text-white border-gold font-bold"
          : "bg-cream text-text/80 border-beige hover:border-gold/50"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ hasItems }: { hasItems: boolean }) {
  return (
    <div className="mt-8 mx-2 rounded-3xl border-2 border-dashed border-beige bg-cream/60 p-8 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-beige/80 text-muted flex items-center justify-center mb-3">
        <ImageOff size={28} strokeWidth={1.6} />
      </div>
      <div className="text-[15px] font-bold text-text">
        {hasItems ? "条件に合うアイテムはありません" : "まだアイテムがありません"}
      </div>
      <div className="text-[13px] text-muted mt-1.5 leading-relaxed">
        {hasItems
          ? "検索ワードやフィルタを変更してみてください"
          : "右下の ＋ から、お店のスクショを取り込んで登録しましょう"}
      </div>
    </div>
  );
}
