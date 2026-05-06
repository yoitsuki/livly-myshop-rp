"use client";

import { useMemo, useState } from "react";
import { useItems, useTags } from "@/lib/firebase/hooks";
import { latestPriceEntry } from "@/lib/firebase/repo";
import { TYPE_LABEL, TYPE_ORDER } from "@/lib/tagTypes";
import SearchBar from "@/components/SearchBar";
import ItemCard from "@/components/ItemCard";
import Fab from "@/components/Fab";
import { ListFilter, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui";
import Link from "next/link";

type SortKey = "checkedAt" | "createdAt" | "price";

export default function Home() {
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("checkedAt");

  const items = useItems();
  const tags = useTags();

  const categories = useMemo(() => {
    const set = new Set<string>();
    items?.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).sort();
  }, [items]);

  const tagUsage = useMemo(() => {
    const map = new Map<string, number>();
    items?.forEach((i) => {
      i.tagIds.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
    });
    return map;
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
        <div className="space-y-2.5">
          {TYPE_ORDER.map((type) => {
            const group = tags.filter(
              (t) =>
                t.type === type &&
                ((tagUsage.get(t.id) ?? 0) > 0 || activeTagIds.includes(t.id)),
            );
            if (group.length === 0) return null;
            return (
              <section key={type} className="space-y-1">
                <h3
                  className="text-[10px] font-medium tracking-[0.18em] uppercase text-[var(--color-muted)] px-1"
                  style={{ fontFamily: "var(--font-label)" }}
                >
                  {TYPE_LABEL[type]}
                </h3>
                <div className="flex gap-1.5 flex-wrap">
                  {group.map((t) => {
                    const on = activeTagIds.includes(t.id);
                    const count = tagUsage.get(t.id) ?? 0;
                    return (
                      <button
                        key={t.id}
                        onClick={() =>
                          setActiveTagIds((prev) =>
                            on ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                          )
                        }
                        className={`px-2.5 h-7 text-[12px] border transition-colors inline-flex items-center gap-1 ${
                          on
                            ? "bg-gold text-white border-gold"
                            : "bg-white border-[var(--color-line)] text-text/80 hover:border-[var(--color-line-strong)]"
                        }`}
                        style={{ borderRadius: 0 }}
                      >
                        <span>#{t.name}</span>
                        <span
                          className={`tabular-nums ${on ? "text-white/75" : "text-[var(--color-muted)]"}`}
                          style={{ fontSize: 10.5 }}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div
        className="flex items-center justify-between px-1 pt-1 text-[var(--color-muted)]"
        style={{ fontFamily: "var(--font-label)", fontSize: 11.5 }}
      >
        <span className="tabular-nums">
          {filtered.length} 件 / 全 {totalCount} 件
        </span>
        <label className="flex items-center gap-1">
          <ListFilter size={14} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-transparent outline-none border-none text-[var(--color-text)]/80"
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
        <ul className="-mx-2">
          {filtered.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} tags={tags ?? []} />
            </li>
          ))}
        </ul>
      )}

      <Fab />
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
      className={`shrink-0 px-3.5 text-[12.5px] border transition-colors ${
        active
          ? "bg-gold text-white border-gold"
          : "bg-white text-text/80 border-[var(--color-line)] hover:border-[var(--color-line-strong)]"
      }`}
      style={{ height: 30, borderRadius: 0, fontFamily: "var(--font-body)" }}
    >
      {label}
    </button>
  );
}

function EmptyState({ hasItems }: { hasItems: boolean }) {
  return (
    <div className="mt-12 px-4 py-10 text-center">
      <PackageOpen
        size={36}
        strokeWidth={1.4}
        className="mx-auto text-muted mb-3"
      />
      <div
        className="text-[18px] text-text"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {hasItems ? "条件に合うアイテムはありません" : "まだアイテムがありません"}
      </div>
      <div className="text-[12.5px] text-muted mt-1.5 leading-relaxed">
        {hasItems
          ? "検索ワードやフィルタを変更してみてください"
          : "右下の ＋ から、お店のスクショを取り込んで登録しましょう"}
      </div>
      {!hasItems && (
        <div className="mt-5 flex justify-center">
          <Link href="/register" className="inline-block">
            <Button variant="primary" size="md">
              新規登録へ
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
