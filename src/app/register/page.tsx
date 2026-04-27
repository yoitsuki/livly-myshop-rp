"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Crop, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import {
  createItem,
  createTag,
  db,
  getSettings,
  type ItemCropRecord,
  type ShopPeriodRecord,
  type Tag,
  type TagType,
} from "@/lib/db";
import { compressImage, type CropRect } from "@/lib/image";
import { getCheckedAt } from "@/lib/exif";
import { recognizeJapanese } from "@/lib/ocr/tesseract";
import { recognizeWithClaude } from "@/lib/ocr/claude";
import { parseShopText, type ExtractedFields } from "@/lib/ocr/parse";
import {
  formatShopPeriod,
  resolveShopPeriod,
  SHOP_ROUNDS,
  type ShopPhase,
} from "@/lib/shopPeriods";
import { detectPresetCrops } from "@/lib/preset";
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
  /** YYYYMM key. Empty = no period selected. */
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

const EMPTY_FORM: FormState = {
  name: "",
  category: "",
  minPrice: "",
  refPriceMin: "",
  refPriceMax: "",
  checkedAt: toLocalInput(Date.now()),
  tagIds: [],
  shopYearMonth: "",
  shopPhase: "ongoing",
  shopAuto: false,
  priceSource: "",
};

type CropTarget = "icon" | "main" | null;

export default function RegisterPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [sourceBlob, setSourceBlob] = useState<Blob | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [iconBlob, setIconBlob] = useState<Blob | undefined>();
  const [mainBlob, setMainBlob] = useState<Blob | undefined>();
  const [iconCrop, setIconCrop] = useState<ItemCropRecord | undefined>();
  const [mainCrop, setMainCrop] = useState<ItemCropRecord | undefined>();
  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [mainUrl, setMainUrl] = useState<string | undefined>();
  const [cropping, setCropping] = useState<CropTarget>(null);
  const [presets, setPresets] = useState<{ icon: CropRect; main: CropRect } | null>(
    null
  );
  const [busy, setBusy] = useState<"idle" | "load" | "ocr" | "save">("idle");
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [error, setError] = useState<string | undefined>();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [autoFilled, setAutoFilled] = useState<Set<keyof FormState>>(new Set());

  const tags = useLiveQuery(() => db().tags.toArray(), [], [] as Tag[]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!iconBlob) {
      setIconUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(iconBlob);
    setIconUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [iconBlob]);

  useEffect(() => {
    if (!mainBlob) {
      setMainUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(mainBlob);
    setMainUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mainBlob]);

  const onPick = () => fileInput.current?.click();

  const handleFile = async (file: File) => {
    setError(undefined);
    setSourceBlob(file);
    setIconBlob(undefined);
    setMainBlob(undefined);
    setIconCrop(undefined);
    setMainCrop(undefined);
    setPresets(null);
    setForm((f) => ({ ...f, checkedAt: toLocalInput(Date.now()) }));
    setAutoFilled(new Set());

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setBusy("load");
    try {
      const checkedAt = await getCheckedAt(file);
      setForm((f) => ({ ...f, checkedAt: toLocalInput(checkedAt) }));
      setAutoFilled((prev) => new Set(prev).add("checkedAt"));

      // Auto-resolve shop period from the picked image's checkedAt
      const resolved = resolveShopPeriod(checkedAt);
      if (resolved) {
        setForm((f) => ({
          ...f,
          shopYearMonth: resolved.round.yearMonth,
          shopPhase: resolved.phase,
          shopAuto: true,
        }));
      }

      // Detect crop presets when the source matches our reference layout
      try {
        const detected = await detectPresetCrops(file);
        setPresets(detected);
      } catch {
        // ignore — fall back to default crop rect
      }

      // OCR runs against a downscaled copy for speed
      const downscaled = await compressImage(file, { maxWidth: 1600, quality: 0.8 });

      setBusy("ocr");
      setOcrProgress(0);
      const settings = await getSettings();
      let extracted: ExtractedFields = {};
      try {
        if (settings.ocrProvider === "claude" && settings.claudeApiKey) {
          extracted = await recognizeWithClaude(
            downscaled,
            settings.claudeApiKey,
            settings.claudeModel
          );
        } else {
          const text = await recognizeJapanese(downscaled, (p) =>
            setOcrProgress(p)
          );
          extracted = parseShopText(text);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "OCR に失敗しました";
        setError(`OCR エラー: ${msg}`);
      }

      setForm((f) => {
        const next: FormState = { ...f };
        const filled = new Set(autoFilled);
        const setStringField = (
          k: "name" | "category" | "minPrice" | "refPriceMin" | "refPriceMax",
          v: string
        ) => {
          if (v && !next[k]) {
            next[k] = v;
            filled.add(k);
          }
        };
        setStringField("name", extracted.name ?? "");
        setStringField("category", extracted.category ?? "");
        if (extracted.minPrice != null)
          setStringField("minPrice", String(extracted.minPrice));
        if (extracted.refPriceMin != null)
          setStringField("refPriceMin", String(extracted.refPriceMin));
        if (extracted.refPriceMax != null)
          setStringField("refPriceMax", String(extracted.refPriceMax));
        setAutoFilled(filled);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像の読み込みに失敗しました");
    } finally {
      setBusy("idle");
    }
  };

  const onSave = async () => {
    if (!iconBlob && !mainBlob) {
      setError("アイコンかメイン画像のどちらかを切り抜いてください");
      return;
    }
    if (!form.name.trim()) {
      setError("アイテム名は必須です");
      return;
    }
    setError(undefined);
    setBusy("save");
    try {
      const shopPeriod: ShopPeriodRecord | undefined = form.shopYearMonth
        ? {
            yearMonth: form.shopYearMonth,
            phase: form.shopPhase,
            auto: !!mainBlob && form.shopAuto,
          }
        : undefined;
      await createItem({
        iconBlob,
        mainImageBlob: mainBlob,
        iconCrop,
        mainCrop,
        name: form.name.trim(),
        category: form.category.trim(),
        minPrice: Number(form.minPrice) || 0,
        refPriceMin: Number(form.refPriceMin) || 0,
        refPriceMax: Number(form.refPriceMax) || 0,
        tagIds: form.tagIds,
        checkedAt: fromLocalInput(form.checkedAt),
        shopPeriod,
        priceSource: !mainBlob && form.priceSource ? form.priceSource.trim() : undefined,
      });
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy("idle");
    }
  };

  const isAuto = (k: keyof FormState) => autoFilled.has(k);

  return (
    <div className="space-y-4 pt-3 pb-6">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {!previewUrl ? (
        <button
          onClick={onPick}
          className="w-full h-32 rounded-2xl border-2 border-dashed border-beige bg-cream/60 flex items-center justify-center gap-3 text-muted active:bg-beige/40"
        >
          <ImagePlus size={26} strokeWidth={1.6} />
          <div className="text-left">
            <div className="text-[14px] font-bold text-text">スクショを選ぶ</div>
            <div className="text-[11px]">タップしてファイルから取り込み</div>
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="プレビュー"
              className="w-full max-h-72 object-contain rounded-2xl border border-beige bg-white"
            />
            <button
              onClick={onPick}
              className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full bg-cream/95 border border-beige text-[12px] text-text/80 shadow"
            >
              画像を変更
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CropSlot
              label="アイコン"
              imageUrl={iconUrl}
              onClick={() => setCropping("icon")}
              onClear={
                iconBlob
                  ? () => {
                      setIconBlob(undefined);
                      setIconCrop(undefined);
                    }
                  : undefined
              }
            />
            <CropSlot
              label="メイン画像"
              imageUrl={mainUrl}
              onClick={() => setCropping("main")}
              onClear={
                mainBlob
                  ? () => {
                      setMainBlob(undefined);
                      setMainCrop(undefined);
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {busy !== "idle" && busy !== "save" && (
        <div className="rounded-xl bg-beige/50 border border-beige px-3 py-2 flex items-center gap-2 text-[13px] text-text/80">
          <Loader2 size={16} className="animate-spin shrink-0" />
          <span>
            {busy === "load" && "画像を読み込み中…"}
            {busy === "ocr" &&
              `テキストを読み取り中… ${Math.round(ocrProgress * 100)}%`}
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-pink/40 border border-pink px-3 py-2 text-[13px] text-text/85">
          {error}
        </div>
      )}

      <Field label="アイテム名" required highlighted={isAuto("name")}>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-transparent outline-none text-[15px] font-bold text-text"
          placeholder="例: 籐の揺りかご"
        />
      </Field>

      <Field label="カテゴリ" highlighted={isAuto("category")}>
        <input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full bg-transparent outline-none text-[14px] text-text"
          placeholder="例: 島デコ右前"
          list="cat-suggestions"
        />
        <CategorySuggestions />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="最低販売価格 (GP)" highlighted={isAuto("minPrice")}>
          <input
            inputMode="numeric"
            value={form.minPrice}
            onChange={(e) =>
              setForm({ ...form, minPrice: e.target.value.replace(/[^\d]/g, "") })
            }
            className="w-full bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="1800"
          />
        </Field>
        <Field label="確認日時" highlighted={isAuto("checkedAt")}>
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
        auto={form.shopAuto && !!mainBlob}
        hasMainImage={!!mainBlob}
        onChange={(yearMonth, phase) =>
          setForm({ ...form, shopYearMonth: yearMonth, shopPhase: phase, shopAuto: false })
        }
      />

      {!mainBlob && (
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

      <Field
        label="参考販売価格 (GP)"
        highlighted={isAuto("refPriceMin") || isAuto("refPriceMax")}
      >
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={form.refPriceMin}
            onChange={(e) =>
              setForm({
                ...form,
                refPriceMin: e.target.value.replace(/[^\d]/g, ""),
              })
            }
            className="w-24 bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="4100"
          />
          <span className="text-muted">〜</span>
          <input
            inputMode="numeric"
            value={form.refPriceMax}
            onChange={(e) =>
              setForm({
                ...form,
                refPriceMax: e.target.value.replace(/[^\d]/g, ""),
              })
            }
            className="w-24 bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="5300"
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
        <button
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-full bg-beige/70 text-text/80 font-bold"
        >
          キャンセル
        </button>
        <button
          onClick={onSave}
          disabled={busy === "save" || (!iconBlob && !mainBlob)}
          className="flex-[2] py-3 rounded-full bg-gold text-white font-bold disabled:opacity-50 active:bg-gold-deep"
        >
          {busy === "save" ? "保存中…" : "保存"}
        </button>
      </div>

      <ImageCropper
        source={cropping ? sourceBlob ?? null : null}
        open={cropping !== null}
        title={cropping === "icon" ? "アイコンを切り抜き" : "メイン画像を切り抜き"}
        maxOutputWidth={cropping === "icon" ? 320 : 1200}
        initialRect={
          cropping === "icon"
            ? iconCrop?.rect ?? presets?.icon
            : cropping === "main"
              ? mainCrop?.rect ?? presets?.main
              : undefined
        }
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
            setIconBlob(result.blob);
            setIconCrop(record);
          } else if (cropping === "main") {
            setMainBlob(result.blob);
            setMainCrop(record);
          }
          setCropping(null);
        }}
      />
    </div>
  );
}

function CropSlot({
  label,
  imageUrl,
  onClick,
  onClear,
}: {
  label: string;
  imageUrl?: string;
  onClick: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="relative rounded-xl border border-beige bg-cream overflow-hidden">
      <button
        type="button"
        onClick={onClick}
        className="block w-full"
      >
        <div className="aspect-square bg-beige/40 flex items-center justify-center text-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={label}
              className="w-full h-full object-cover"
            />
          ) : (
            <Crop size={28} strokeWidth={1.6} />
          )}
        </div>
        <div className="px-2 py-1 text-[12px] font-bold text-text/80 text-center">
          {label}
          {!imageUrl && <span className="text-[10px] text-muted ml-1">未設定</span>}
        </div>
      </button>
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
  highlighted,
  children,
}: {
  label: string;
  required?: boolean;
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-1.5 mb-1 px-1">
        <span className="text-[12px] text-muted font-bold">{label}</span>
        {required && <span className="text-[11px] text-gold-deep">*</span>}
        {highlighted && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-gold-deep">
            <Sparkles size={11} />
            自動入力
          </span>
        )}
      </div>
      <div
        className={`rounded-xl bg-cream border px-3 py-2 transition-colors ${
          highlighted ? "border-gold/60 bg-mint/30" : "border-beige"
        }`}
      >
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
    <datalist id="cat-suggestions">
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
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
              className="p-1 text-muted"
            >
              <X size={14} />
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
