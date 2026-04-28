"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Crop, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import {
  clearMainImage,
  createTag,
  db,
  updateItemImage,
  updateItemMeta,
  type Item,
  type ItemCropRecord,
  type ShopPeriodRecord,
  type Tag,
  type TagType,
} from "@/lib/db";
import {
  formatShopPeriod,
  SHOP_ROUNDS,
  type ShopPhase,
} from "@/lib/shopPeriods";
import { toLocalInput, fromLocalInput } from "@/lib/utils/date";
import TagChip from "@/components/TagChip";
import ImageCropper from "@/components/ImageCropper";

interface FormState {
  name: string;
  category: string;
  minPrice: string;
  refPriceMin: string;
  refPriceMax: string;
  checkedAt: string;
  tagIds: string[];
  shopYearMonth: string;
  shopPhase: ShopPhase;
  shopAuto: boolean;
  priceSource: string;
}

const SOURCE_PRESETS: Array<{ value: string; label: string }> = [
  { value: "", label: "選択しない" },
  { value: "ライブリーガイド (https://livly-guide.com/)", label: "ライブリーガイド" },
  { value: "公式 X / 旧 Twitter", label: "公式 X / 旧 Twitter" },
  { value: "個人ブログ", label: "個人ブログ" },
  { value: "他プレイヤーのお店", label: "他プレイヤーのお店" },
];

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
  // True after the user has clicked the X on the main slot — staged in
  // component state and only persisted on 保存. Picking a new main file or
  // confirming a fresh main crop resets this back to false.
  const [pendingClearMain, setPendingClearMain] = useState(false);
  const [cropping, setCropping] = useState<CropTarget>(null);

  const savedIcon = item?.iconBlob ?? item?.thumbBlob;
  const savedMain = item?.mainImageBlob ?? item?.imageBlob;
  // What the slot previews show: pending crop wins, then a staged delete
  // hides the saved blob, otherwise we fall back to whatever's on disk.
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
      minPrice: String(item.minPrice ?? ""),
      refPriceMin: String(item.refPriceMin ?? ""),
      refPriceMax: String(item.refPriceMax ?? ""),
      checkedAt: toLocalInput(item.checkedAt),
      tagIds: item.tagIds,
      shopYearMonth: item.shopPeriod?.yearMonth ?? "",
      shopPhase: item.shopPeriod?.phase ?? "ongoing",
      shopAuto: item.shopPeriod?.auto ?? false,
      priceSource: item.priceSource ?? "",
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

  // Per-slot file pickers — picking on the icon slot only touches the icon
  // source, and vice-versa. We never share a source between the two slots.
  const onPickIconFile = () => iconFileInput.current?.click();
  const onPickMainFile = () => mainFileInput.current?.click();

  const onIconFile = (file: File) => {
    setError(undefined);
    setIconSource(file);
    setCropping("icon");
  };

  const onMainFile = (file: File) => {
    setError(undefined);
    // A fresh file overrides any staged delete — the user is providing a new
    // main image, so we shouldn't clear it.
    setPendingClearMain(false);
    setMainSource(file);
    setCropping("main");
  };

  // Re-crop a slot using its own most recent blob: pending crop result first,
  // then a fresh file picked this session, then the saved blob. The saved blob
  // is wrapped in a fresh Blob so IndexedDB never sees a mutation.
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

  // Source the cropper actually sees while open — distinct per target so the
  // icon flow never touches the main image and vice-versa.
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
      // Persist any staged crop results first so the meta-edit save sees the
      // freshest state. Each slot is updated independently — leaving one
      // untouched doesn't disturb the other on disk.
      if (pendingIcon) {
        await updateItemImage(i.id, {
          iconBlob: pendingIcon.blob,
          iconCrop: pendingIcon.crop,
        });
      }
      // pendingClearMain wins over a stale pendingMain (kept mutually
      // exclusive in the handlers, but we still defend against both being set).
      if (pendingClearMain) {
        await clearMainImage(i.id);
      } else if (pendingMain) {
        await updateItemImage(i.id, {
          mainImageBlob: pendingMain.blob,
          mainCrop: pendingMain.crop,
        });
      }
      const hasMainAfterSave = pendingClearMain
        ? false
        : !!(pendingMain?.blob ?? i.mainImageBlob);
      const shopPeriod: ShopPeriodRecord | undefined = form.shopYearMonth
        ? {
            yearMonth: form.shopYearMonth,
            phase: form.shopPhase,
            auto: hasMainAfterSave && form.shopAuto,
          }
        : undefined;
      await updateItemMeta(i.id, {
        name: form.name.trim(),
        category: form.category.trim(),
        minPrice: Number(form.minPrice) || 0,
        refPriceMin: Number(form.refPriceMin) || 0,
        refPriceMax: Number(form.refPriceMax) || 0,
        tagIds: form.tagIds,
        checkedAt: fromLocalInput(form.checkedAt),
        shopPeriod,
        priceSource:
          !hasMainAfterSave && form.priceSource ? form.priceSource.trim() : undefined,
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

      <ShopPeriodField
        yearMonth={form.shopYearMonth}
        phase={form.shopPhase}
        auto={form.shopAuto && !!i.mainImageBlob}
        hasMainImage={!!i.mainImageBlob}
        onChange={(yearMonth, phase) =>
          setForm({
            ...form,
            shopYearMonth: yearMonth,
            shopPhase: phase,
            shopAuto: false,
          })
        }
      />

      {!i.mainImageBlob && (
        <Field label="情報元 (メイン画像が無いとき)">
          <select
            value={
              SOURCE_PRESETS.some((p) => p.value === form.priceSource)
                ? form.priceSource
                : ""
            }
            onChange={(e) => setForm({ ...form, priceSource: e.target.value })}
            className="w-full bg-transparent outline-none text-[13px] text-text mb-1"
          >
            {SOURCE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            value={form.priceSource}
            onChange={(e) => setForm({ ...form, priceSource: e.target.value })}
            placeholder="自由入力 (URL や説明)"
            className="w-full bg-transparent outline-none text-[13px] text-text border-t border-beige/60 pt-1.5"
          />
        </Field>
      )}

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
        // Edit-mode crops are fine adjustments on the already-cropped blob:
        // ignore presets/saved rect entirely and start with the full extent so
        // the user nudges the frame inward as needed.
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
            // Confirming a fresh main crop overrides any staged delete.
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

function ShopPeriodField({
  yearMonth,
  phase,
  auto,
  hasMainImage,
  onChange,
}: {
  yearMonth: string;
  phase: ShopPhase;
  auto: boolean;
  hasMainImage: boolean;
  onChange: (yearMonth: string, phase: ShopPhase) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1 px-1">
        <span className="text-[12px] text-muted font-bold">マイショップ時期</span>
        {auto && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-gold-deep">
            <Sparkles size={11} />
            画像から自動判定
          </span>
        )}
        {!hasMainImage && (
          <span className="text-[10px] text-muted">手動選択</span>
        )}
      </div>
      <div className="rounded-xl bg-cream border border-beige px-3 py-2 flex items-center gap-2 flex-wrap">
        <select
          value={yearMonth}
          onChange={(e) => onChange(e.target.value, phase)}
          className="flex-1 min-w-[8rem] bg-transparent outline-none text-[13px]"
        >
          <option value="">未指定</option>
          {SHOP_ROUNDS.map((r) => (
            <option key={r.yearMonth} value={r.yearMonth}>
              {r.yearMonth} (第{r.roundNumber}回)
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          {(["ongoing", "lastDay"] as ShopPhase[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(yearMonth, p)}
              className={`px-2 py-px rounded-full text-[11px] border ${
                phase === p
                  ? "bg-gold/20 border-gold text-gold-deep font-bold"
                  : "bg-cream border-beige text-text/70"
              }`}
            >
              {p === "ongoing" ? "開催中" : "最終日"}
            </button>
          ))}
        </div>
      </div>
      {yearMonth && (
        <div className="px-1 pt-0.5 text-[10.5px] text-muted tabular-nums">
          表示: [{formatShopPeriod(yearMonth, phase)}]
        </div>
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
