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
type ReplicaFilter = "original" | "all" | "replica";

export default function Home() {
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [replicaFilter, setReplicaFilter] = useState<ReplicaFilter>("all");
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

  /** Items after q / category / tag filters, before the replica segment.
   *  Used both as the source for the replica counts (so the numbers reflect
   *  the current narrowed-down view) and as the input to the replica filter. */
  const preReplicaFiltered = useMemo(() => {
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
    return list;
  }, [items, q, activeCategory, activeTagIds]);

  const replicaCounts = useMemo(() => {
    let original = 0;
    let replica = 0;
    for (const i of preReplicaFiltered) {
      if (i.isReplica === true) replica++;
      else original++;
    }
    return { original, all: original + replica, replica };
  }, [preReplicaFiltered]);

  const filtered = useMemo(() => {
    let list = preReplicaFiltered;
    if (replicaFilter === "original") {
      list = list.filter((i) => !i.isReplica);
    } else if (replicaFilter === "replica") {
      list = list.filter((i) => i.isReplica === true);
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
  }, [preReplicaFiltered, replicaFilter, sort]);

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

      {/* 原本 / レプリカ 3 値セグメント — 「両方」既定。 在庫があれば常に
          表示 ( アイテム 0 件で隠す )。 */}
      {totalCount > 0 && (
        <div className="flex gap-0 px-1 pt-1">
          <ReplicaSegmentButton
            label="原本のみ"
            count={replicaCounts.original}
            active={replicaFilter === "original"}
            onClick={() => setReplicaFilter("original")}
          />
          <ReplicaSegmentButton
            label="両方"
            count={replicaCounts.all}
            active={replicaFilter === "all"}
            onClick={() => setReplicaFilter("all")}
          />
          <ReplicaSegmentButton
            label="レプリカのみ"
            count={replicaCounts.replica}
            active={replicaFilter === "replica"}
            onClick={() => setReplicaFilter("replica")}
          />
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

/** 3 値セグメントの 1 ボタン。隣り合うボタンと border が 2px 線にならない
 *  よう左隣との重なりを `-ml-px` で吸収する Atelier セグメント。 */
function ReplicaSegmentButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-2 h-8 text-[11.5px] border inline-flex items-center justify-center gap-1 transition-colors -ml-px first:ml-0 ${
        active
          ? "bg-gold text-white border-gold relative z-10"
          : "bg-white text-text/80 border-[var(--color-line)] hover:border-[var(--color-line-strong)]"
      }`}
      style={{ borderRadius: 0, fontFamily: "var(--font-body)" }}
    >
      <span>{label}</span>
      <span
        className={`tabular-nums ${active ? "text-white/80" : "text-[var(--color-muted)]"}`}
        style={{ fontSize: 10 }}
      >
        {count}
      </span>
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
