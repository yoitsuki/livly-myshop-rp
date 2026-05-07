"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crop, RefreshCw, X } from "lucide-react";
import { useItem, useItems, useTags } from "@/lib/firebase/hooks";
import {
  createTag,
  updateItem,
  type Item,
  type ItemCropRecord,
  type Tag,
  type TagType,
} from "@/lib/firebase/repo";
import TagChip from "@/components/TagChip";
import ImageCropper from "@/components/ImageCropper";
import { Button, Field, inputClass } from "@/components/ui";
import { useDirtyTracker } from "@/lib/unsavedChanges";

interface FormState {
  name: string;
  category: string;
  tagIds: string[];
  minPrice: string;
  isReplica: boolean;
}

type CropTarget = "icon" | "main" | null;

export default function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const item = useItem(id);
  const tags = useTags() ?? [];
  const iconFileInput = useRef<HTMLInputElement>(null);
  const mainFileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState | undefined>();
  const [busy, setBusy] = useState<"idle" | "save">("idle");
  const [error, setError] = useState<string | undefined>();

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

  const savedIconUrl = item?.iconUrl;
  const savedMainUrl = item?.mainImageUrl;
  const pendingIconBlob = pendingIcon?.blob;
  const pendingMainBlob = pendingMain?.blob;
  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [mainUrl, setMainUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!item) return;
    setForm({
      name: item.name,
      category: item.category,
      tagIds: item.tagIds,
      minPrice: String(item.minPrice ?? ""),
      isReplica: item.isReplica === true,
    });
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingIconBlob) {
      const url = URL.createObjectURL(pendingIconBlob);
      setIconUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setIconUrl(savedIconUrl);
  }, [pendingIconBlob, savedIconUrl]);

  useEffect(() => {
    const showSaved = !pendingMainBlob && !pendingClearMain;
    if (pendingMainBlob) {
      const url = URL.createObjectURL(pendingMainBlob);
      setMainUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setMainUrl(showSaved ? savedMainUrl : undefined);
  }, [pendingMainBlob, pendingClearMain, savedMainUrl]);

  const dirty = useMemo(() => {
    if (!form || !item) return false;
    if (pendingIcon || pendingMain || pendingClearMain) return true;
    if (form.name !== item.name) return true;
    if (form.category !== item.category) return true;
    if (form.minPrice !== String(item.minPrice ?? "")) return true;
    if (form.isReplica !== (item.isReplica === true)) return true;
    const a = [...form.tagIds].sort();
    const b = [...(item.tagIds ?? [])].sort();
    if (a.length !== b.length || a.some((x, i) => x !== b[i])) return true;
    return false;
  }, [form, item, pendingIcon, pendingMain, pendingClearMain]);
  useDirtyTracker(dirty);

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

  const startCrop = async (target: "icon" | "main") => {
    setError(undefined);
    let src: Blob | undefined =
      target === "icon"
        ? pendingIcon?.blob ?? iconSource
        : pendingMain?.blob ?? mainSource;
    if (!src) {
      const url =
        target === "icon"
          ? savedIconUrl
          : pendingClearMain
            ? undefined
            : savedMainUrl;
      if (url) {
        try {
          src = await fetchAsBlob(url);
          if (target === "icon") setIconSource(src);
          else setMainSource(src);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "保存済み画像の取得に失敗しました",
          );
          return;
        }
      }
    }
    if (!src) {
      setError(
        target === "icon"
          ? "アイコン画像が登録されていません。先に「ファイル」から画像を選んでください"
          : "メイン画像が登録されていません。先に「ファイル」から画像を選んでください",
      );
      return;
    }
    setCropping(target);
  };

  const cropperSource: Blob | null =
    cropping === "icon"
      ? pendingIcon?.blob ?? iconSource ?? null
      : cropping === "main"
        ? pendingMain?.blob ?? mainSource ?? null
        : null;

  const onSave = async () => {
    if (!form.name.trim()) {
      setError("アイテム名は必須です");
      return;
    }
    setError(undefined);
    setBusy("save");
    try {
      await updateItem(i.id, {
        name: form.name.trim(),
        category: form.category.trim(),
        tagIds: form.tagIds,
        minPrice: Number(form.minPrice) || 0,
        iconBlob: pendingIcon?.blob,
        iconCrop: pendingIcon?.crop,
        mainImageBlob: !pendingClearMain ? pendingMain?.blob : undefined,
        mainCrop: !pendingClearMain ? pendingMain?.crop : undefined,
        clearMain: pendingClearMain,
        isReplica: form.isReplica,
      });
      router.replace(`/items/${i.id}`);
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
    <div className="pt-3 pb-8 space-y-5">
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
            !pendingClearMain && (pendingMain || savedMainUrl)
              ? onClearMain
              : undefined
          }
        />
      </div>
      <p className="text-[11px] text-muted px-1 -mt-2 leading-relaxed">
        「ファイル」で画像を選び直すか、「切り抜き」で現在の画像を微調整できます。
        保存ボタンを押すまでは反映されません。
        マイショップごとの参考価格は詳細画面から追加・編集します。
      </p>

      {error && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)] px-3 py-2 text-[13px] text-text">
          {error}
        </div>
      )}

      <Field label="アイテム名" required>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={`${inputClass()} text-[17px]`}
          style={{ fontFamily: "var(--font-display)" }}
        />
      </Field>

      <Field label="カテゴリ">
        <input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className={inputClass()}
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
          className={`${inputClass()} tabular-nums`}
        />
      </Field>

      <TagPicker
        tags={tags}
        selected={form.tagIds}
        onChange={(ids) => setForm({ ...form, tagIds: ids })}
      />

      <label className="flex items-center gap-2 px-1 py-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.isReplica}
          onChange={(e) => setForm({ ...form, isReplica: e.target.checked })}
          className="w-4 h-4 accent-[var(--color-gold-deep)]"
        />
        <span
          className="text-[13px] text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          レプリカ
        </span>
        <span className="text-[10.5px] text-[var(--color-muted)] ml-1">
          ( 原本でない場合のみ ON )
        </span>
      </label>

      <div className="flex gap-2 pt-2">
        <Link href={`/items/${i.id}`} className="flex-1">
          <Button variant="secondary" size="lg" fullWidth>
            キャンセル
          </Button>
        </Link>
        <div className="flex-[2]">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onSave}
            loading={busy === "save"}
          >
            {busy === "save" ? "保存中…" : "保存"}
          </Button>
        </div>
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
    <div className="relative border border-[var(--color-line)] bg-white overflow-hidden">
      <div className="aspect-square bg-[var(--color-line-soft)] flex items-center justify-center text-muted">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <Crop size={28} strokeWidth={1.6} />
        )}
      </div>
      <div className="px-2 pt-1.5 text-[11px] font-medium text-text/80 text-center tracking-wide">
        {label}
      </div>
      <div className="border-t border-[var(--color-line)] mt-1 flex divide-x divide-[var(--color-line)]">
        <button
          type="button"
          onClick={onPick}
          className="flex-1 py-1.5 text-[11px] text-text/70 hover:text-text hover:bg-[var(--color-line-soft)] inline-flex items-center justify-center gap-1 transition-colors"
        >
          <RefreshCw size={11} />
          ファイル
        </button>
        <button
          type="button"
          onClick={onClickCrop}
          className="flex-1 py-1.5 text-[11px] text-text/70 hover:text-text hover:bg-[var(--color-line-soft)] inline-flex items-center justify-center gap-1 transition-colors"
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
          className="absolute top-1 right-1 w-6 h-6 bg-text/85 text-white flex items-center justify-center hover:bg-text transition-colors"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`画像取得に失敗しました (${res.status})`);
  }
  return res.blob();
}

function CategorySuggestions() {
  const items = useItems();
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
  const [newType, setNewType] = useState<TagType>("other");

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
    <Field label="タグ">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={`px-2.5 h-7 text-[12px] border transition-colors ${
                  on
                    ? "bg-gold text-white border-gold"
                    : "bg-white border-[var(--color-line)] text-text/80 hover:border-[var(--color-line-strong)]"
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
              className="px-2.5 h-7 text-[12px] border border-dashed border-[var(--color-line-strong)] text-muted hover:text-text hover:border-gold/60 transition-colors"
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
              className={`${inputClass({ fullWidth: false })} flex-1 min-w-0 h-9`}
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
              className={`${inputClass({ fullWidth: false })} w-24 shrink-0 h-9 text-[12px]`}
            >
              <option value="gacha">ニューマハラ</option>
              <option value="bazaar">バザール</option>
              <option value="nuts">ナッツ</option>
              <option value="gradely">グレデリー</option>
              <option value="collab">コラボ</option>
              <option value="creators">クリエイターズ</option>
              <option value="other">その他</option>
            </select>
            <Button onClick={add} size="sm">
              追加
            </Button>
          </div>
        )}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--color-line)]">
            {tags
              .filter((t) => selected.includes(t.id))
              .map((t) => (
                <TagChip key={t.id} tag={t} onRemove={() => toggle(t.id)} />
              ))}
          </div>
        )}
      </div>
    </Field>
  );
}
