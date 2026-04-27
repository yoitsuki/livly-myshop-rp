"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2 } from "lucide-react";
import {
  createTag,
  db,
  updateItemImage,
  updateItemMeta,
  type Item,
  type Tag,
  type TagType,
} from "@/lib/db";
import { buildStoredImages } from "@/lib/image";
import { toLocalInput, fromLocalInput } from "@/lib/utils/date";
import TagChip from "@/components/TagChip";

interface FormState {
  name: string;
  category: string;
  description: string;
  minPrice: string;
  refPriceMin: string;
  refPriceMax: string;
  checkedAt: string;
  tagIds: string[];
}

export default function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const item = useLiveQuery(() => db().items.get(id), [id]);
  const tags = useLiveQuery(() => db().tags.toArray(), [], [] as Tag[]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState | undefined>();
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState<"idle" | "image" | "save">("idle");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!item) return;
    setForm({
      name: item.name,
      category: item.category,
      description: item.description,
      minPrice: String(item.minPrice ?? ""),
      refPriceMin: String(item.refPriceMin ?? ""),
      refPriceMax: String(item.refPriceMax ?? ""),
      checkedAt: toLocalInput(item.checkedAt),
      tagIds: item.tagIds,
    });
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const blob = item?.imageBlob ?? item?.thumbBlob;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item?.imageBlob, item?.thumbBlob]);

  if (item === undefined || !form) {
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

  const onPickImage = () => fileInput.current?.click();

  const onReplaceImage = async (file: File) => {
    setError(undefined);
    setBusy("image");
    try {
      const built = await buildStoredImages(file);
      await updateItemImage(i.id, {
        imageBlob: built.imageBlob,
        thumbBlob: built.thumbBlob,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像の更新に失敗しました");
    } finally {
      setBusy("idle");
    }
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      setError("アイテム名は必須です");
      return;
    }
    setError(undefined);
    setBusy("save");
    try {
      await updateItemMeta(i.id, {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        minPrice: Number(form.minPrice) || 0,
        refPriceMin: Number(form.refPriceMin) || 0,
        refPriceMax: Number(form.refPriceMax) || 0,
        tagIds: form.tagIds,
        checkedAt: fromLocalInput(form.checkedAt),
      });
      router.push(`/items/${i.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy("idle");
    }
  };

  return (
    <div className="pt-3 pb-6 space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onReplaceImage(f);
          e.target.value = "";
        }}
      />

      <div className="relative rounded-2xl border border-beige bg-white overflow-hidden">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={form.name}
            className="w-full max-h-72 object-contain bg-white"
          />
        )}
        <button
          onClick={onPickImage}
          className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full bg-cream/95 border border-beige text-[12px] text-text/80 shadow"
        >
          画像を差し替え
        </button>
      </div>

      {busy === "image" && (
        <div className="rounded-xl bg-beige/50 border border-beige px-3 py-2 flex items-center gap-2 text-[13px]">
          <Loader2 size={16} className="animate-spin shrink-0" />
          画像を更新中…
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-pink/40 border border-pink px-3 py-2 text-[13px]">
          {error}
        </div>
      )}

      <Field label="アイテム名" required>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-transparent outline-none text-[15px] font-bold text-text"
        />
      </Field>

      <Field label="カテゴリ">
        <input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full bg-transparent outline-none text-[14px] text-text"
          list="cat-suggestions-edit"
        />
        <CategorySuggestions />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="最低販売価格 (GP)">
          <input
            inputMode="numeric"
            value={form.minPrice}
            onChange={(e) =>
              setForm({ ...form, minPrice: e.target.value.replace(/[^\d]/g, "") })
            }
            className="w-full bg-transparent outline-none text-[14px] text-text tabular-nums"
          />
        </Field>
        <Field label="確認日時">
          <input
            type="datetime-local"
            value={form.checkedAt}
            onChange={(e) => setForm({ ...form, checkedAt: e.target.value })}
            className="w-full bg-transparent outline-none text-[13px] text-text"
          />
        </Field>
      </div>

      <Field label="参考販売価格 (GP)">
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={form.refPriceMin}
            onChange={(e) =>
              setForm({ ...form, refPriceMin: e.target.value.replace(/[^\d]/g, "") })
            }
            className="w-24 bg-transparent outline-none text-[14px] text-text tabular-nums"
          />
          <span className="text-muted">〜</span>
          <input
            inputMode="numeric"
            value={form.refPriceMax}
            onChange={(e) =>
              setForm({ ...form, refPriceMax: e.target.value.replace(/[^\d]/g, "") })
            }
            className="w-24 bg-transparent outline-none text-[14px] text-text tabular-nums"
          />
          <span className="text-muted text-[12px]">GP</span>
        </div>
      </Field>

      <Field label="説明文">
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full bg-transparent outline-none text-[13px] text-text resize-y"
        />
      </Field>

      <TagPicker
        tags={tags}
        selected={form.tagIds}
        onChange={(ids) => setForm({ ...form, tagIds: ids })}
      />

      <div className="flex gap-2 pt-2">
        <Link
          href={`/items/${i.id}`}
          className="flex-1 py-3 rounded-full bg-beige/70 text-text/80 font-bold text-center"
        >
          キャンセル
        </Link>
        <button
          onClick={onSave}
          disabled={busy === "save"}
          className="flex-[2] py-3 rounded-full bg-gold text-white font-bold disabled:opacity-50 active:bg-gold-deep"
        >
          {busy === "save" ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-1.5 mb-1 px-1">
        <span className="text-[12px] text-muted font-bold">{label}</span>
        {required && <span className="text-[11px] text-gold-deep">*</span>}
      </div>
      <div className="rounded-xl bg-cream border border-beige px-3 py-2">
        {children}
      </div>
    </label>
  );
}

function CategorySuggestions() {
  const items = useLiveQuery(() => db().items.toArray(), [], []);
  const categories = useMemo(() => {
    const set = new Set<string>();
    items?.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).sort();
  }, [items]);
  return (
    <datalist id="cat-suggestions-edit">
      {categories.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}

function TagPicker({
  tags,
  selected,
  onChange,
}: {
  tags: Tag[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<TagType>("custom");

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = await createTag({ name, type: newType });
    onChange([...selected, id]);
    setNewName("");
    setAdding(false);
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1 px-1">
        <span className="text-[12px] text-muted font-bold">タグ</span>
      </div>
      <div className="rounded-xl bg-cream border border-beige px-3 py-2 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={`px-2 py-px rounded-full text-[11px] border transition-colors ${
                  on
                    ? "bg-gold/15 border-gold text-gold-deep font-bold"
                    : "bg-cream border-beige text-text/70"
                }`}
              >
                #{t.name}
              </button>
            );
          })}
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="px-2 py-px rounded-full text-[11px] border border-dashed border-beige-deep text-muted"
            >
              ＋ 新規タグ
            </button>
          )}
        </div>
        {adding && (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="タグ名"
              className="flex-1 min-w-0 px-2 py-1 rounded-md bg-beige/40 outline-none text-[13px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TagType)}
              className="px-2 py-1 rounded-md bg-beige/40 text-[12px] outline-none"
            >
              <option value="period">期間</option>
              <option value="gacha">ガチャ</option>
              <option value="category">分類</option>
              <option value="custom">カスタム</option>
            </select>
            <button
              type="button"
              onClick={add}
              className="px-3 py-1 rounded-md bg-gold text-white text-[12px] font-bold"
            >
              追加
            </button>
          </div>
        )}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-beige/50">
            {tags
              .filter((t) => selected.includes(t.id))
              .map((t) => (
                <TagChip key={t.id} tag={t} onRemove={() => toggle(t.id)} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
