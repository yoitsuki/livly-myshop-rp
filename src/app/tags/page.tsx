"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Home, Trash2 } from "lucide-react";
import {
  createTag,
  db,
  deleteTag,
  type Tag,
  type TagType,
} from "@/lib/db";

const TYPE_LABEL: Record<TagType, string> = {
  period: "期間",
  gacha: "ガチャ",
  category: "分類",
  custom: "カスタム",
};

const TYPE_ORDER: TagType[] = ["gacha", "period", "category", "custom"];

export default function TagsPage() {
  const tags = useLiveQuery(() => db().tags.toArray(), [], [] as Tag[]);
  const items = useLiveQuery(() => db().items.toArray(), [], []);
  const [name, setName] = useState("");
  const [type, setType] = useState<TagType>("custom");

  const usageCount = useMemo(() => {
    const map = new Map<string, number>();
    items?.forEach((i) => {
      i.tagIds.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
    });
    return map;
  }, [items]);

  const grouped = useMemo(() => {
    const m = new Map<TagType, Tag[]>();
    TYPE_ORDER.forEach((t) => m.set(t, []));
    tags.forEach((t) => m.get(t.type)?.push(t));
    return m;
  }, [tags]);

  const onAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.name === trimmed)) return;
    await createTag({ name: trimmed, type });
    setName("");
  };

  const onDelete = async (t: Tag) => {
    const usage = usageCount.get(t.id) ?? 0;
    if (
      !confirm(
        usage > 0
          ? `タグ「${t.name}」は ${usage} 件のアイテムで使われています。削除すると外れます。続行しますか？`
          : `タグ「${t.name}」を削除しますか？`
      )
    )
      return;
    if (usage > 0 && items) {
      await db().transaction("rw", db().items, async () => {
        for (const it of items) {
          if (it.tagIds.includes(t.id)) {
            await db().items.update(it.id, {
              tagIds: it.tagIds.filter((x) => x !== t.id),
            });
          }
        }
      });
    }
    await deleteTag(t.id);
  };

  return (
    <div className="pt-3 pb-6 space-y-4">
      <div className="rounded-2xl bg-cream border border-beige p-3 space-y-2">
        <div className="text-[12px] text-muted font-bold px-1">新しいタグ</div>
        <div className="flex items-center gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder="タグ名"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-beige/40 outline-none text-[14px]"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TagType)}
            className="px-2 py-2 rounded-lg bg-beige/40 text-[12px] outline-none"
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <button
            onClick={onAdd}
            className="px-4 py-2 rounded-lg bg-gold text-white text-[13px] font-bold"
          >
            追加
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {TYPE_ORDER.map((t) => {
          const list = grouped.get(t) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={t}>
              <h3 className="text-[12px] text-muted font-bold px-1 mb-1">
                {TYPE_LABEL[t]}
              </h3>
              <ul className="rounded-2xl bg-cream border border-beige divide-y divide-beige/70 overflow-hidden">
                {list.map((tag) => {
                  const count = usageCount.get(tag.id) ?? 0;
                  return (
                    <li
                      key={tag.id}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      <span className="flex-1 min-w-0 truncate text-[14px] text-text">
                        #{tag.name}
                      </span>
                      <span className="text-[11px] text-muted shrink-0">
                        {count}件
                      </span>
                      <button
                        onClick={() => onDelete(tag)}
                        className="p-1.5 rounded-md text-muted hover:bg-beige/50"
                        aria-label="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {tags.length === 0 && (
          <div className="text-center text-muted text-[13px] mt-6">
            まだタグがありません。
            <br />
            上のフォームから追加してください。
          </div>
        )}
      </div>

      <Link
        href="/"
        className="mt-4 w-full py-3 rounded-full bg-beige/70 text-text/85 font-bold text-center inline-flex items-center justify-center gap-1.5"
      >
        <Home size={16} />
        ホームに戻る
      </Link>
    </div>
  );
}
