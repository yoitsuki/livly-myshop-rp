"use client";

import { useMemo, useState } from "react";
import { useItems, useTags } from "@/lib/firebase/hooks";
import { latestPriceEntry } from "@/lib/firebase/repo";
import { TYPE_LABEL, TYPE_ORDER } from "@/lib/tagTypes";
import type { TagType, Tag } from "@/lib/firebase/types";
import SearchBar from "@/components/SearchBar";
import ItemCard from "@/components/ItemCard";
import Fab from "@/components/Fab";
import {
  ChevronRight,
  ListFilter,
  Loader2,
  PackageOpen,
  SlidersHorizontal,
  X,
} from "lucide-react";
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [tagSectionOpen, setTagSectionOpen] = useState<
    Partial<Record<TagType, boolean>>
  >({});

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

  const loading = items === undefined;
  const totalCount = items?.length ?? 0;

  /** Active-filter count shown as a badge on the toggle button so the user
   *  knows filters are on even when the panel is collapsed. q is excluded —
   *  the search bar stays visible and already shows the value. */
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (replicaFilter !== "all") n++;
    if (activeCategory) n++;
    n += activeTagIds.length;
    return n;
  }, [replicaFilter, activeCategory, activeTagIds]);

  const hasAnyFilterUI = totalCount > 0 || (tags?.length ?? 0) > 0;

  /** Reset every panel-level filter back to defaults. q ( SearchBar ) は
   *  独立した入力なのであえて触らない — ユーザーは検索文字列を保ったまま
   *  絞込みだけリセットしたいことが多い。activeFilterCount === 0 になる
   *  ので「クリア」バーも自動で消える。 */
  const clearFilters = () => {
    setReplicaFilter("all");
    setActiveCategory(null);
    setActiveTagIds([]);
  };

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-stretch gap-2">
        <div className="flex-1 min-w-0">
          <SearchBar value={q} onChange={setQ} />
        </div>
        {hasAnyFilterUI && (
          <FilterToggleButton
            open={filterOpen}
            activeCount={activeFilterCount}
            onClick={() => setFilterOpen((v) => !v)}
          />
        )}
      </div>

      {filterOpen && hasAnyFilterUI && (
        <div
          id="home-filter-panel"
          className="space-y-3 border border-[var(--color-line)] bg-white px-3 py-3"
        >
          {activeFilterCount > 0 && (
            <div className="flex items-center justify-between gap-2 px-1">
              <span
                className="text-[10.5px] tracking-[0.18em] uppercase text-[var(--color-muted)]"
                style={{ fontFamily: "var(--font-label)" }}
              >
                絞込み中 {activeFilterCount} 件
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2.5 h-7 border border-[var(--color-line)] bg-white text-[var(--color-text)]/80 text-[11px] hover:border-[var(--color-line-strong)] hover:text-[var(--color-text)] transition-colors"
                style={{
                  borderRadius: 0,
                  fontFamily: "var(--font-label)",
                  letterSpacing: "0.08em",
                }}
              >
                <X size={12} strokeWidth={1.8} />
                クリア
              </button>
            </div>
          )}

          {/* 1. 原本・レプリカ */}
          {totalCount > 0 && (
            <section className="space-y-1">
              <h3
                className="text-[10px] font-medium tracking-[0.18em] uppercase text-[var(--color-muted)] px-1"
                style={{ fontFamily: "var(--font-label)" }}
              >
                原本・レプリカ
              </h3>
              <div className="flex gap-0">
                <ReplicaSegmentButton
                  label="両方"
                  count={replicaCounts.all}
                  active={replicaFilter === "all"}
                  onClick={() => setReplicaFilter("all")}
                />
                <ReplicaSegmentButton
                  label="原本のみ"
                  count={replicaCounts.original}
                  active={replicaFilter === "original"}
                  onClick={() => setReplicaFilter("original")}
                />
                <ReplicaSegmentButton
                  label="レプリカのみ"
                  count={replicaCounts.replica}
                  active={replicaFilter === "replica"}
                  onClick={() => setReplicaFilter("replica")}
                />
              </div>
            </section>
          )}

          {/* 2. カテゴリ */}
          {categories.length > 0 && (
            <section className="space-y-1">
              <h3
                className="text-[10px] font-medium tracking-[0.18em] uppercase text-[var(--color-muted)] px-1"
                style={{ fontFamily: "var(--font-label)" }}
              >
                カテゴリ
              </h3>
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
            </section>
          )}

          {/* 3. タグ — type 別に折り畳み、既定で全部閉じる */}
          {tags && tags.length > 0 && (
            <div className="space-y-1.5">
              {TYPE_ORDER.map((type) => (
                <TagSection
                  key={type}
                  type={type}
                  tags={tags}
                  tagUsage={tagUsage}
                  activeTagIds={activeTagIds}
                  setActiveTagIds={setActiveTagIds}
                  open={!!tagSectionOpen[type]}
                  onToggleOpen={() =>
                    setTagSectionOpen((p) => ({ ...p, [type]: !p[type] }))
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <>
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
        </>
      )}

      <Fab />
    </div>
  );
}

/** SearchBar の右に並ぶフィルタパネル開閉ボタン。アクティブフィルタ件数を
 *  右上のバッジで示すので、パネルを閉じても "フィルタ中" が分かる。 */
function FilterToggleButton({
  open,
  activeCount,
  onClick,
}: {
  open: boolean;
  activeCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="home-filter-panel"
      className={`relative shrink-0 inline-flex items-center justify-center gap-1.5 px-3 border transition-colors ${
        open
          ? "bg-gold text-white border-gold"
          : "bg-white text-text/80 border-[var(--color-line)] hover:border-[var(--color-line-strong)]"
      }`}
      style={{ height: 42, borderRadius: 0, fontFamily: "var(--font-body)" }}
    >
      <SlidersHorizontal size={16} strokeWidth={1.6} />
      <span className="text-[12.5px]">絞込み</span>
      {activeCount > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center bg-gold-deep text-white tabular-nums"
          style={{
            minWidth: 16,
            height: 16,
            paddingLeft: 4,
            paddingRight: 4,
            fontSize: 10,
            borderRadius: 0,
            fontFamily: "var(--font-label)",
          }}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
}

/** 1 つの tag type を折り畳みで表示。見出し横に賢いトグル
 *  ( 全部選択中なら "全て解除"、それ以外は "全て選択" ) を持つ。 */
function TagSection({
  type,
  tags,
  tagUsage,
  activeTagIds,
  setActiveTagIds,
  open,
  onToggleOpen,
}: {
  type: TagType;
  tags: Tag[];
  tagUsage: Map<string, number>;
  activeTagIds: string[];
  setActiveTagIds: React.Dispatch<React.SetStateAction<string[]>>;
  open: boolean;
  onToggleOpen: () => void;
}) {
  const visible = tags.filter(
    (t) =>
      t.type === type &&
      ((tagUsage.get(t.id) ?? 0) > 0 || activeTagIds.includes(t.id)),
  );
  if (visible.length === 0) return null;

  const activeIdSet = new Set(activeTagIds);
  const activeInSection = visible.filter((t) => activeIdSet.has(t.id)).length;
  const allSelected = activeInSection === visible.length;
  const selectAllLabel = allSelected ? "全て解除" : "全て選択";

  const toggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const idsInSection = visible.map((t) => t.id);
    if (allSelected) {
      setActiveTagIds((prev) => prev.filter((id) => !idsInSection.includes(id)));
    } else {
      setActiveTagIds((prev) => Array.from(new Set([...prev, ...idsInSection])));
    }
  };

  return (
    <section className="border-t border-[var(--color-line)] first:border-t-0 pt-1.5 first:pt-0">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-1 py-1 text-left"
      >
        <ChevronRight
          size={14}
          strokeWidth={1.6}
          className={`text-[var(--color-muted)] shrink-0 transition-transform duration-150 ${
            open ? "rotate-90" : ""
          }`}
        />
        <h3
          className="text-[10px] font-medium tracking-[0.18em] uppercase text-[var(--color-muted)] flex-1"
          style={{ fontFamily: "var(--font-label)" }}
        >
          {TYPE_LABEL[type]}
        </h3>
        <span
          className="text-[10px] tabular-nums text-[var(--color-muted)]"
          style={{ fontFamily: "var(--font-label)" }}
        >
          {activeInSection > 0
            ? `${activeInSection}/${visible.length}`
            : `${visible.length}`}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={toggleAll}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleAll(e as unknown as React.MouseEvent);
            }
          }}
          className="px-2 h-6 inline-flex items-center border border-[var(--color-line)] bg-white text-text/75 text-[10px] tracking-[0.08em] hover:border-[var(--color-line-strong)] cursor-pointer select-none"
          style={{ borderRadius: 0, fontFamily: "var(--font-label)" }}
        >
          {selectAllLabel}
        </span>
      </button>

      {open && (
        <div className="flex gap-1.5 flex-wrap px-1 pt-1.5 pb-0.5">
          {visible.map((t) => {
            const on = activeIdSet.has(t.id);
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
      )}
    </section>
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

function LoadingState() {
  return (
    <div className="mt-12 px-4 py-10 text-center">
      <Loader2
        size={28}
        strokeWidth={1.4}
        className="mx-auto text-muted mb-3 animate-spin"
      />
      <div
        className="text-[12.5px] text-[var(--color-muted)]"
        style={{ fontFamily: "var(--font-label)", letterSpacing: "0.12em" }}
      >
        読み込み中…
      </div>
    </div>
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
