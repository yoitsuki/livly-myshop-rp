"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Crop, ImagePlus, Loader2, ScanText, Sparkles, X } from "lucide-react";
import {
  createItem,
  createTag,
  db,
  getSettings,
  uid,
  type ItemCropRecord,
  type PriceEntry,
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
import { findMatchingPreset, SEED_PRESETS } from "@/lib/preset";
import { toLocalInput, fromLocalInput } from "@/lib/utils/date";
import TagChip from "@/components/TagChip";
import ImageCropper from "@/components/ImageCropper";
import { Button, Field, inputClass } from "@/components/ui";

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
  { value: "なんおし", label: "なんおし" },
  { value: "その他", label: "その他" },
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
  const settings = useLiveQuery(() => db().settings.get("singleton"), []);
  const [ocrDone, setOcrDone] = useState(false);

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
    setOcrDone(false);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setBusy("load");
    try {
      const s = await getSettings();

      const checkedAt = await getCheckedAt(file);
      setForm((f) => ({ ...f, checkedAt: toLocalInput(checkedAt) }));
      setAutoFilled((prev) => new Set(prev).add("checkedAt"));

      const resolved = resolveShopPeriod(checkedAt);
      if (resolved) {
        setForm((f) => ({
          ...f,
          shopYearMonth: resolved.round.yearMonth,
          shopPhase: resolved.phase,
          shopAuto: true,
        }));
      }

      try {
        const list = s.cropPresets ?? SEED_PRESETS;
        const matched = await findMatchingPreset(file, list);
        setPresets(matched ? { icon: matched.icon, main: matched.main } : null);
      } catch {
        // fall back to default crop rect
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像の読み込みに失敗しました");
    } finally {
      setBusy("idle");
    }
  };

  const runOcr = async () => {
    if (!sourceBlob) return;
    setError(undefined);
    setBusy("ocr");
    setOcrProgress(0);
    try {
      const s = await getSettings();
      const downscaled = await compressImage(sourceBlob, {
        maxWidth: 1600,
        quality: 0.8,
      });
      let extracted: ExtractedFields = {};
      try {
        if (s.ocrProvider === "claude" && s.claudeApiKey) {
          extracted = await recognizeWithClaude(
            downscaled,
            s.claudeApiKey,
            s.claudeModel
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
        return;
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
      setOcrDone(true);
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
      const now = Date.now();
      const initialEntry: PriceEntry = {
        id: uid(),
        shopPeriod,
        refPriceMin: Number(form.refPriceMin) || 0,
        refPriceMax: Number(form.refPriceMax) || 0,
        checkedAt: fromLocalInput(form.checkedAt),
        priceSource:
          !mainBlob && form.priceSource ? form.priceSource.trim() : undefined,
        createdAt: now,
      };
      await createItem({
        iconBlob,
        mainImageBlob: mainBlob,
        iconCrop,
        mainCrop,
        name: form.name.trim(),
        category: form.category.trim(),
        tagIds: form.tagIds,
        minPrice: Number(form.minPrice) || 0,
        priceEntries: [initialEntry],
      });
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy("idle");
    }
  };

  const isAuto = (k: keyof FormState) => autoFilled.has(k);
  const autoBadge = (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-gold-deep font-medium normal-case tracking-normal">
      <Sparkles size={11} />
      自動入力
    </span>
  );

  return (
    <div className="space-y-5 pt-3 pb-8">
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
          className="w-full h-32 border border-dashed border-[var(--color-line-strong)] bg-white flex items-center justify-center gap-3 text-text/85 hover:bg-[var(--color-line-soft)] transition-colors duration-150 ease-out"
        >
          <ImagePlus size={26} strokeWidth={1.6} className="text-gold-deep" />
          <div className="text-left">
            <div
              className="text-[16px] text-text"
              style={{ fontFamily: "var(--font-display)" }}
            >
              スクショを選ぶ
            </div>
            <div className="text-[11px] text-muted">タップしてファイルから取り込み</div>
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="プレビュー"
              className="w-full max-h-72 object-contain border border-[var(--color-line)] bg-white"
            />
            <button
              onClick={onPick}
              className="absolute bottom-2 right-2 px-3 h-8 bg-white/95 border border-[var(--color-line)] text-[12px] text-text/80"
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

      {previewUrl && (
        <Button
          type="button"
          variant="secondary"
          size="md"
          fullWidth
          onClick={runOcr}
          loading={busy === "ocr"}
          disabled={busy !== "idle" || !sourceBlob}
          icon={busy === "ocr" ? undefined : <ScanText size={16} />}
        >
          {ocrDone ? "OCR を再実行" : "OCR で自動入力"}
          <span className="text-[11px] text-muted font-normal">
            (
            {settings?.ocrProvider === "claude" && settings?.claudeApiKey
              ? `Claude API・${settings.claudeModel ?? "claude-sonnet-4-6"}`
              : "Tesseract (端末内)"}
            )
          </span>
        </Button>
      )}

      {busy !== "idle" && busy !== "save" && (
        <div className="bg-[var(--color-line-soft)] border border-[var(--color-line)] px-3 py-2 flex items-center gap-2 text-[13px] text-text/80">
          <Loader2 size={16} className="animate-spin shrink-0 text-gold-deep" />
          <span>
            {busy === "load" && "画像を読み込み中…"}
            {busy === "ocr" &&
              `テキストを読み取り中… ${Math.round(ocrProgress * 100)}%`}
          </span>
        </div>
      )}

      {error && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)] px-3 py-2 text-[13px] text-text">
          {error}
        </div>
      )}

      <Field
        label="アイテム名"
        required
        labelAdornment={isAuto("name") ? autoBadge : undefined}
      >
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={`${inputClass({ highlighted: isAuto("name") })} text-[17px]`}
          style={{ fontFamily: "var(--font-display)" }}
          placeholder="例: 籐の揺りかご"
        />
      </Field>

      <Field
        label="カテゴリ"
        labelAdornment={isAuto("category") ? autoBadge : undefined}
      >
        <input
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className={inputClass({ highlighted: isAuto("category") })}
          placeholder="例: 島デコ右前"
          list="cat-suggestions"
        />
        <CategorySuggestions />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="最低販売価格 (GP)"
          labelAdornment={isAuto("minPrice") ? autoBadge : undefined}
        >
          <input
            inputMode="numeric"
            value={form.minPrice}
            onChange={(e) =>
              setForm({ ...form, minPrice: e.target.value.replace(/[^\d]/g, "") })
            }
            className={`${inputClass({ highlighted: isAuto("minPrice") })} tabular-nums`}
            placeholder="1800"
          />
        </Field>
        <Field
          label="確認日時"
          labelAdornment={isAuto("checkedAt") ? autoBadge : undefined}
        >
          <input
            type="datetime-local"
            value={form.checkedAt}
            onChange={(e) => setForm({ ...form, checkedAt: e.target.value })}
            className={`${inputClass({ highlighted: isAuto("checkedAt") })} text-[13px]`}
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
            value={form.priceSource}
            onChange={(e) => setForm({ ...form, priceSource: e.target.value })}
            className={inputClass()}
          >
            {SOURCE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label="参考販売価格 (GP)"
        labelAdornment={
          isAuto("refPriceMin") || isAuto("refPriceMax") ? autoBadge : undefined
        }
      >
        <div
          className={`${inputClass({ highlighted: isAuto("refPriceMin") || isAuto("refPriceMax") })} flex items-center gap-2 focus-within:border-gold focus-within:shadow-[var(--shadow-focus)]`}
        >
          <input
            inputMode="numeric"
            value={form.refPriceMin}
            onChange={(e) =>
              setForm({
                ...form,
                refPriceMin: e.target.value.replace(/[^\d]/g, ""),
              })
            }
            className="w-20 bg-transparent outline-none text-[14px] text-text tabular-nums"
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
            className="w-20 bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="5300"
          />
          <span className="text-muted text-[12px] ml-auto">GP</span>
        </div>
      </Field>

      <TagPicker
        tags={tags}
        selected={form.tagIds}
        onChange={(ids) => setForm({ ...form, tagIds: ids })}
      />

      <div className="flex gap-2 pt-2">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => router.back()}
          className="flex-1"
        >
          キャンセル
        </Button>
        <div className="flex-[2]">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onSave}
            loading={busy === "save"}
            disabled={busy === "save" || (!iconBlob && !mainBlob)}
          >
            {busy === "save" ? "保存中…" : "保存"}
          </Button>
        </div>
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
    <div className="relative border border-[var(--color-line)] bg-white overflow-hidden">
      <button type="button" onClick={onClick} className="block w-full">
        <div className="aspect-square bg-[var(--color-line-soft)] flex items-center justify-center text-muted">
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
        <div className="px-2 py-1.5 text-[11px] font-medium text-text/80 text-center tracking-wide">
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
          className="absolute top-1 right-1 w-6 h-6 bg-text/85 text-white flex items-center justify-center hover:bg-text transition-colors"
        >
          <X size={14} strokeWidth={1.8} />
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
  const adornment = auto ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-gold-deep font-medium normal-case tracking-normal">
      <Sparkles size={11} />
      画像から自動判定
    </span>
  ) : !hasMainImage ? (
    <span className="text-[10px] text-muted normal-case tracking-normal">
      手動選択
    </span>
  ) : undefined;

  return (
    <Field
      label="マイショップ時期"
      labelAdornment={adornment}
      hint={
        yearMonth
          ? `表示: [${formatShopPeriod(yearMonth, phase)}]`
          : undefined
      }
    >
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={yearMonth}
          onChange={(e) => onChange(e.target.value, phase)}
          className={`${inputClass({ highlighted: auto })} flex-1 min-w-[10rem] text-[13px]`}
        >
          <option value="">未指定</option>
          {SHOP_ROUNDS.map((r) => (
            <option key={r.yearMonth} value={r.yearMonth}>
              {r.yearMonth} (第{r.roundNumber}回)
            </option>
          ))}
        </select>
        <div className="inline-flex bg-white border border-[var(--color-line)] p-0.5">
          {(["ongoing", "lastDay"] as ShopPhase[]).map((p) => {
            const active = phase === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange(yearMonth, p)}
                className={`px-3 h-9 text-[12px] transition-colors ${
                  active
                    ? "bg-gold text-white"
                    : "text-text/70 hover:text-text"
                }`}
              >
                {p === "ongoing" ? "開催中" : "最終日"}
              </button>
            );
          })}
        </div>
      </div>
    </Field>
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
              <option value="period">期間</option>
              <option value="gacha">ガチャ</option>
              <option value="category">分類</option>
              <option value="custom">カスタム</option>
            </select>
            <Button onClick={add} size="sm">
              追加
            </Button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
              className="p-1 text-muted hover:text-text"
            >
              <X size={14} />
            </button>
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
