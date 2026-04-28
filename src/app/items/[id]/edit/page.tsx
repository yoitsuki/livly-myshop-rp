"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Crop, Loader2, RefreshCw, X } from "lucide-react";
import {
  createTag,
  db,
  type Item,
  type ItemCropRecord,
  type Tag,
  type TagType,
} from "@/lib/db";
import TagChip from "@/components/TagChip";
import ImageCropper from "@/components/ImageCropper";

interface FormState {
  name: string;
  category: string;
  tagIds: string[];
  minPrice: string;
}

type CropTarget = "icon" | "main" | null;

export default function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const item = useLiveQuery(() => db().items.get(id), [id]);
  const tags = useLiveQuery(() => db().tags.toArray(), [], [] as Tag[]);
  const iconFileInput = useRef<HTMLInputElement>(null);
  const mainFileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState | undefined>();
  const [busy, setBusy] = useState<"idle" | "save">("idle");
  const [error, setError] = useState<string | undefined>();

  // Per-slot pending source (a fresh file picked this session) and pending
  // crop result (output of the cropper). Nothing here is written to IndexedDB
  // until the user presses 保存; cancel/back simply discards it all.
  const [iconSource, setIconSource] = useState<Blob | undefined>();
  const [mainSource, setMainSource] = useState<Blob | undefined>();
  const [pendingIcon, setPendingIcon] = useState<
    { blob: Blob; crop: ItemCropRecord } | undefined
  >();
  const [pendingMain, setPendingMain] = useState<
    { blob: Blob; crop: ItemCropRecord } | undefined
  >();
  const [pendingClearMain, setPendingClearMain] = useState(false);
  const [cropping, setCropping] = useState<CropTarget>(null);

  const savedIcon = item?.iconBlob;
  const savedMain = item?.mainImageBlob;
  const displayIcon = pendingIcon?.blob ?? savedIcon;
  const displayMain = pendingMain?.blob
    ?? (pendingClearMain ? undefined : savedMain);
  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [mainUrl, setMainUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!item) return;
    setForm({
      name: item.name,
      category: item.category,
      tagIds: item.tagIds,
      minPrice: String(item.minPrice ?? ""),
    });
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!displayIcon) return setIconUrl(undefined);
    const url = URL.createObjectURL(displayIcon);
    setIconUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [displayIcon]);

  useEffect(() => {
    if (!displayMain) return setMainUrl(undefined);
    const url = URL.createObjectURL(displayMain);
    setMainUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [displayMain]);

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

  const onPickIconFile = () => iconFileInput.current?.click();
  const onPickMainFile = () => mainFileInput.current?.click();

  const onIconFile = (file: File) => {
    setError(undefined);
    setIconSource(file);
    setCropping("icon");
  };

  const onMainFile = (file: File) => {
    setError(undefined);
    setPendingClearMain(false);
    setMainSource(file);
    setCropping("main");
  };

  const startCrop = (target: "icon" | "main") => {
    const mainSavedIfNotCleared = pendingClearMain ? undefined : savedMain;
    const sources = target === "icon"
      ? [pendingIcon?.blob, iconSource, savedIcon]
      : [pendingMain?.blob, mainSource, mainSavedIfNotCleared];
    const src = sources.find((b): b is Blob => !!b);
    if (!src) {
      setError(
        target === "icon"
          ? "アイコン画像が登録されていません。先に「ファイル」から画像を選んでください"
          : "メイン画像が登録されていません。先に「ファイル」から画像を選んでください"
      );
      return;
    }
    setError(undefined);
    setCropping(target);
  };

  const cropperSource: Blob | null = cropping === "icon"
    ? pendingIcon?.blob ?? iconSource ?? savedIcon ?? null
    : cropping === "main"
      ? pendingMain?.blob ?? mainSource ?? (pendingClearMain ? null : savedMain ?? null)
      : null;

  const onSave = async () => {
    if (!form.name.trim()) {
      setError("アイテム名は必須です");
      return;
    }
    setError(undefined);
    setBusy("save");
    try {
      // Apply every change in a single transaction with one read + one put.
      // Splitting into multiple transactions causes Safari/Chrome to throw
      // "Error preparing Blob/File data..." when sibling Blobs survive a
      // record across transaction boundaries.
      await db().transaction("rw", db().items, async () => {
        const current = await db().items.get(i.id);
        if (!current) throw new Error("アイテムが見つかりませんでした");
        const next: Item = { ...current };

        if (pendingIcon) {
          next.iconBlob = pendingIcon.blob;
          next.iconCrop = pendingIcon.crop;
        }
        if (pendingClearMain) {
          delete next.mainImageBlob;
          delete next.mainCrop;
        } else if (pendingMain) {
          next.mainImageBlob = pendingMain.blob;
          next.mainCrop = pendingMain.crop;
        }

        next.name = form.name.trim();
        next.category = form.category.trim();
        next.tagIds = form.tagIds;
        next.minPrice = Number(form.minPrice) || 0;
        next.updatedAt = Date.now();

        await db().items.put(next);
      });
      router.push(`/items/${i.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy("idle");
    }
  };

  const onClearMain = () => {
    if (
      !confirm(
        "メイン画像を削除します（保存ボタンを押すまで反映されません）。よろしいですか？"
      )
    )
      return;
    setPendingMain(undefined);
    setMainSource(undefined);
    setPendingClearMain(true);
  };

  return (
    <div className="pt-3 pb-6 space-y-4">
      <input
        ref={iconFileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onIconFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={mainFileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onMainFile(f);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        <SlotPreview
          label="アイコン"
          imageUrl={iconUrl}
          onClickCrop={() => startCrop("icon")}
          onPick={onPickIconFile}
        />
        <SlotPreview
          label="メイン画像"
          imageUrl={mainUrl}
          onClickCrop={() => startCrop("main")}
          onPick={onPickMainFile}
          onClear={
            !pendingClearMain && (pendingMain || savedMain)
              ? onClearMain
              : undefined
          }
        />
      </div>
      <p className="text-[11px] text-muted px-1 -mt-2">
        「ファイル」で画像を選び直すか、「切り抜き」で現在の画像を
        微調整できます。保存ボタンを押すまでは反映されません。
        マイショップごとの参考価格は詳細画面から追加・編集します。
      </p>

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
          {busy === "save" ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" />
              保存中…
            </span>
          ) : (
            "保存"
          )}
        </button>
      </div>

      <ImageCropper
        source={cropperSource}
        open={cropping !== null}
        title={cropping === "icon" ? "アイコンを切り抜き" : "メイン画像を切り抜き"}
        maxOutputWidth={cropping === "icon" ? 320 : 1200}
        fillExtent
        onCancel={() => setCropping(null)}
        onConfirm={(result) => {
          const record: ItemCropRecord = {
            rect: {
              x: Math.round(result.rect.x),
              y: Math.round(result.rect.y),
              w: Math.round(result.rect.w),
              h: Math.round(result.rect.h),
            },
            source: result.source,
            croppedAt: Date.now(),
          };
          if (cropping === "icon") {
            setPendingIcon({ blob: result.blob, crop: record });
          } else if (cropping === "main") {
            setPendingClearMain(false);
            setPendingMain({ blob: result.blob, crop: record });
          }
          setCropping(null);
        }}
      />
    </div>
  );
}

function SlotPreview({
  label,
  imageUrl,
  onClickCrop,
  onPick,
  onClear,
}: {
  label: string;
  imageUrl?: string;
  onClickCrop: () => void;
  onPick: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="relative rounded-xl border border-beige bg-cream overflow-hidden">
      <div className="aspect-square bg-beige/40 flex items-center justify-center text-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <Crop size={28} strokeWidth={1.6} />
        )}
      </div>
      <div className="px-2 py-1 text-[12px] font-bold text-text/80 text-center">
        {label}
      </div>
      <div className="border-t border-beige flex divide-x divide-beige">
        <button
          type="button"
          onClick={onPick}
          className="flex-1 py-1.5 text-[11px] text-text/70 inline-flex items-center justify-center gap-1"
        >
          <RefreshCw size={11} />
          ファイル
        </button>
        <button
          type="button"
          onClick={onClickCrop}
          className="flex-1 py-1.5 text-[11px] text-text/70 inline-flex items-center justify-center gap-1"
        >
          <Crop size={11} />
          切り抜き
        </button>
      </div>
      {onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label={`${label}を削除`}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-text/85 text-cream flex items-center justify-center hover:bg-text"
        >
          <X size={14} strokeWidth={2.6} />
        </button>
      )}
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
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
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
