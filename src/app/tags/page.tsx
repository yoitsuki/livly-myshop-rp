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
import { Button, Field, inputClass, IconButton } from "@/components/ui";

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
    <div className="pt-3 pb-8 space-y-6">
      <Field label="新しいタグ">
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
            className={`${inputClass({ fullWidth: false })} flex-1 min-w-0`}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TagType)}
            className={`${inputClass({ fullWidth: false })} w-24 shrink-0`}
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <Button onClick={onAdd} size="md" variant="primary">
            追加
          </Button>
        </div>
      </Field>

      <div className="space-y-5">
        {TYPE_ORDER.map((t) => {
          const list = grouped.get(t) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={t} className="space-y-1">
              <h3 className="text-[10px] font-medium tracking-[0.18em] uppercase text-gold-deep px-1">
                {TYPE_LABEL[t]}
              </h3>
              <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
                {list.map((tag) => {
                  const count = usageCount.get(tag.id) ?? 0;
                  return (
                    <li
                      key={tag.id}
                      className="flex items-center gap-2 px-2 py-2.5"
                    >
                      <span className="flex-1 min-w-0 truncate text-[14px] text-text">
                        #{tag.name}
                      </span>
                      <span className="text-[11px] text-muted shrink-0 tabular-nums">
                        {count} 件
                      </span>
                      <IconButton
                        size="sm"
                        onClick={() => onDelete(tag)}
                        aria-label="削除"
                      >
                        <Trash2 size={14} />
                      </IconButton>
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

      <Link href="/" className="block">
        <Button variant="secondary" size="lg" fullWidth icon={<Home size={16} />}>
          ホームに戻る
        </Button>
      </Link>
    </div>
  );
}
