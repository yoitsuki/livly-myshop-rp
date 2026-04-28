"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ImagePlus, Loader2, ScanText, Sparkles } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { compressImage } from "@/lib/image";
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
import { toLocalInput } from "@/lib/utils/date";

export interface PriceEntryFormValue {
  refPriceMin: string;
  refPriceMax: string;
  shopYearMonth: string;
  shopPhase: ShopPhase;
  shopAuto: boolean;
  /** Local-input (datetime-local) string. */
  checkedAt: string;
  priceSource: string;
}

export const EMPTY_PRICE_ENTRY_FORM: PriceEntryFormValue = {
  refPriceMin: "",
  refPriceMax: "",
  shopYearMonth: "",
  shopPhase: "ongoing",
  shopAuto: false,
  checkedAt: "",
  priceSource: "",
};

export const PRICE_SOURCE_PRESETS: Array<{ value: string; label: string }> = [
  { value: "", label: "選択しない" },
  { value: "なんおし", label: "なんおし" },
  { value: "その他", label: "その他" },
];

interface Props {
  value: PriceEntryFormValue;
  onChange: (v: PriceEntryFormValue) => void;
  /** Show the screenshot picker that auto-fills checkedAt + period and
   * exposes an OCR button for the reference-price fields. */
  allowSourcePicker?: boolean;
  /** Whether to show the priceSource dropdown — set when item has no main image. */
  showPriceSource: boolean;
}

export default function PriceEntryForm({
  value,
  onChange,
  allowSourcePicker,
  showPriceSource,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState<"idle" | "load" | "ocr">("idle");
  const [ocrDone, setOcrDone] = useState(false);
  const [ocrError, setOcrError] = useState<string | undefined>();
  const settings = useLiveQuery(() => db().settings.get("singleton"), []);

  useEffect(() => {
    if (!pickedFile) return setPreviewUrl(undefined);
    const url = URL.createObjectURL(pickedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pickedFile]);

  const handleFile = async (file: File) => {
    setPickedFile(file);
    setOcrDone(false);
    setOcrError(undefined);
    setBusy("load");
    try {
      const checkedAt = await getCheckedAt(file);
      const resolved = resolveShopPeriod(checkedAt);
      onChange({
        ...value,
        checkedAt: toLocalInput(checkedAt),
        shopYearMonth: resolved ? resolved.round.yearMonth : value.shopYearMonth,
        shopPhase: resolved ? resolved.phase : value.shopPhase,
        shopAuto: !!resolved,
      });
    } finally {
      setBusy("idle");
    }
  };

  const runOcr = async () => {
    if (!pickedFile) return;
    setOcrError(undefined);
    setBusy("ocr");
    try {
      const s = await getSettings();
      const downscaled = await compressImage(pickedFile, {
        maxWidth: 1600,
        quality: 0.8,
      });
      let extracted: ExtractedFields = {};
      if (s.ocrProvider === "claude" && s.claudeApiKey) {
        extracted = await recognizeWithClaude(
          downscaled,
          s.claudeApiKey,
          s.claudeModel
        );
      } else {
        const text = await recognizeJapanese(downscaled);
        extracted = parseShopText(text);
      }
      // Only the reference-price fields belong on a price entry now —
      // minPrice lives on Item, and name/category belong to the item too.
      const next: PriceEntryFormValue = { ...value };
      if (extracted.refPriceMin != null && !next.refPriceMin) {
        next.refPriceMin = String(extracted.refPriceMin);
      }
      if (extracted.refPriceMax != null && !next.refPriceMax) {
        next.refPriceMax = String(extracted.refPriceMax);
      }
      onChange(next);
      setOcrDone(true);
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : "OCR に失敗しました");
    } finally {
      setBusy("idle");
    }
  };

  const ocrLabel =
    settings?.ocrProvider === "claude" && settings?.claudeApiKey
      ? `Claude API・${settings.claudeModel ?? "claude-sonnet-4-6"}`
      : "Tesseract (端末内)";

  return (
    <div className="space-y-4">
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
      {allowSourcePicker && (
        <div className="space-y-2">
          {!previewUrl ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-beige bg-cream/60 flex items-center justify-center gap-2 text-text/85 active:bg-beige/40"
            >
              <ImagePlus size={20} strokeWidth={1.6} />
              <div className="text-left">
                <div className="text-[14px] font-bold">スクショから自動入力</div>
                <div className="text-[10.5px] text-muted">画像は保存されません</div>
              </div>
            </button>
          ) : (
            <>
              <div className="rounded-2xl border border-beige bg-white flex items-center gap-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="読み込み中の画像"
                  className="w-16 h-16 object-cover rounded-md shrink-0"
                />
                <div className="min-w-0 flex-1 text-[12px] text-text/85">
                  <div className="truncate font-bold">
                    {pickedFile?.name ?? "選択した画像"}
                  </div>
                  <div className="text-muted text-[11px] inline-flex items-center gap-1">
                    {busy === "load" ? (
                      <>
                        <Loader2 size={11} className="animate-spin" />
                        読み込み中…
                      </>
                    ) : (
                      "読み込み済 (画像は保存されません)"
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="text-[11px] text-text/70 hover:text-text px-2 py-1 rounded-md bg-beige/50 shrink-0"
                >
                  変更
                </button>
              </div>
              <button
                type="button"
                onClick={runOcr}
                disabled={busy !== "idle"}
                className="w-full py-2.5 rounded-full border border-mint bg-mint/30 text-text font-bold text-[13.5px] flex items-center justify-center gap-2 disabled:opacity-50 active:bg-mint/50"
              >
                {busy === "ocr" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ScanText size={16} />
                )}
                {ocrDone ? "OCR を再実行" : "OCR で自動入力"}
                <span className="text-[11px] text-muted font-normal">
                  ({ocrLabel})
                </span>
              </button>
              {ocrError && (
                <div className="text-[12px] text-text/85 bg-pink/40 border border-pink rounded-md px-2 py-1.5">
                  {ocrError}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Field label="参考販売価格 (GP)">
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={value.refPriceMin}
            onChange={(e) =>
              onChange({ ...value, refPriceMin: e.target.value.replace(/[^\d]/g, "") })
            }
            className="w-24 bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="4100"
          />
          <span className="text-muted">〜</span>
          <input
            inputMode="numeric"
            value={value.refPriceMax}
            onChange={(e) =>
              onChange({ ...value, refPriceMax: e.target.value.replace(/[^\d]/g, "") })
            }
            className="w-24 bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="5300"
          />
          <span className="text-muted text-[12px]">GP</span>
        </div>
      </Field>

      <Field label="確認日時">
        <input
          type="datetime-local"
          value={value.checkedAt}
          onChange={(e) => onChange({ ...value, checkedAt: e.target.value })}
          className="w-full bg-transparent outline-none text-[13px] text-text"
        />
      </Field>

      <div>
        <div className="flex items-center gap-1.5 mb-1 px-1">
          <span className="text-[12px] text-muted font-bold">マイショップ時期</span>
          {value.shopAuto && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gold-deep">
              <Sparkles size={11} />
              画像から自動判定
            </span>
          )}
        </div>
        <div className="rounded-xl bg-cream border border-beige px-3 py-2 flex items-center gap-2 flex-wrap">
          <select
            value={value.shopYearMonth}
            onChange={(e) =>
              onChange({ ...value, shopYearMonth: e.target.value, shopAuto: false })
            }
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
                onClick={() => onChange({ ...value, shopPhase: p, shopAuto: false })}
                className={`px-2 py-px rounded-full text-[11px] border ${
                  value.shopPhase === p
                    ? "bg-gold/20 border-gold text-gold-deep font-bold"
                    : "bg-cream border-beige text-text/70"
                }`}
              >
                {p === "ongoing" ? "開催中" : "最終日"}
              </button>
            ))}
          </div>
        </div>
        {value.shopYearMonth && (
          <div className="px-1 pt-0.5 text-[10.5px] text-muted tabular-nums">
            表示: [{formatShopPeriod(value.shopYearMonth, value.shopPhase)}]
          </div>
        )}
      </div>

      {showPriceSource && (
        <Field label="情報元 (メイン画像が無いとき)">
          <select
            value={value.priceSource}
            onChange={(e) => onChange({ ...value, priceSource: e.target.value })}
            className="w-full bg-transparent outline-none text-[13px] text-text"
          >
            {PRICE_SOURCE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-1.5 mb-1 px-1">
        <span className="text-[12px] text-muted font-bold">{label}</span>
      </div>
      <div className="rounded-xl bg-cream border border-beige px-3 py-2">
        {children}
      </div>
    </label>
  );
}
