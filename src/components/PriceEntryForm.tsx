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
import { Button, Field, fieldInputClass } from "@/components/ui";

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
              className="w-full py-3 rounded-lg border border-dashed border-[var(--color-line-strong)] bg-white
                flex items-center justify-center gap-2 text-text/85 hover:bg-[var(--color-line-soft)]
                transition-colors duration-150 ease-out"
            >
              <ImagePlus size={20} strokeWidth={1.8} className="text-gold-deep" />
              <div className="text-left">
                <div className="text-[14px] font-bold">スクショから自動入力</div>
                <div className="text-[10.5px] text-muted">画像は保存されません</div>
              </div>
            </button>
          ) : (
            <>
              <div className="rounded-lg border border-[var(--color-line)] bg-white flex items-center gap-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="読み込み中の画像"
                  className="w-16 h-16 object-cover rounded-lg shrink-0"
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInput.current?.click()}
                >
                  変更
                </Button>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="md"
                fullWidth
                onClick={runOcr}
                loading={busy === "ocr"}
                icon={
                  busy === "ocr" ? undefined : (
                    <ScanText size={16} strokeWidth={2} />
                  )
                }
              >
                {ocrDone ? "OCR を再実行" : "OCR で自動入力"}
                <span className="text-[11px] text-muted font-normal">
                  ({ocrLabel})
                </span>
              </Button>
              {ocrError && (
                <div className="text-[12px] text-text/85 bg-[var(--color-danger-soft)] border border-[#e9b9c0] rounded-md px-2.5 py-1.5">
                  {ocrError}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Field label="参考販売価格 (GP)">
        <div
          className={`${fieldInputClass} flex items-center gap-2 px-3 focus-within:border-gold focus-within:shadow-[var(--shadow-focus)]`}
        >
          <input
            inputMode="numeric"
            value={value.refPriceMin}
            onChange={(e) =>
              onChange({ ...value, refPriceMin: e.target.value.replace(/[^\d]/g, "") })
            }
            className="w-20 bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="4100"
          />
          <span className="text-muted">〜</span>
          <input
            inputMode="numeric"
            value={value.refPriceMax}
            onChange={(e) =>
              onChange({ ...value, refPriceMax: e.target.value.replace(/[^\d]/g, "") })
            }
            className="w-20 bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="5300"
          />
          <span className="text-muted text-[12px] ml-auto">GP</span>
        </div>
      </Field>

      <Field label="確認日時">
        <input
          type="datetime-local"
          value={value.checkedAt}
          onChange={(e) => onChange({ ...value, checkedAt: e.target.value })}
          className={fieldInputClass}
        />
      </Field>

      <Field
        label="マイショップ時期"
        labelAdornment={
          value.shopAuto ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gold-deep font-medium normal-case tracking-normal">
              <Sparkles size={11} />
              画像から自動判定
            </span>
          ) : undefined
        }
        hint={
          value.shopYearMonth
            ? `表示: [${formatShopPeriod(value.shopYearMonth, value.shopPhase)}]`
            : undefined
        }
      >
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={value.shopYearMonth}
            onChange={(e) =>
              onChange({ ...value, shopYearMonth: e.target.value, shopAuto: false })
            }
            className={`${fieldInputClass} flex-1 min-w-[10rem]`}
          >
            <option value="">未指定</option>
            {SHOP_ROUNDS.map((r) => (
              <option key={r.yearMonth} value={r.yearMonth}>
                {r.yearMonth} (第{r.roundNumber}回)
              </option>
            ))}
          </select>
          <div className="inline-flex bg-white border border-[var(--color-line)] rounded-md p-0.5">
            {(["ongoing", "lastDay"] as ShopPhase[]).map((p) => {
              const active = value.shopPhase === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange({ ...value, shopPhase: p, shopAuto: false })}
                  className={`px-3 h-9 rounded text-[12px] transition-colors ${
                    active
                      ? "bg-gold text-white font-bold"
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

      {showPriceSource && (
        <Field label="情報元 (メイン画像が無いとき)">
          <select
            value={value.priceSource}
            onChange={(e) => onChange({ ...value, priceSource: e.target.value })}
            className={fieldInputClass}
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
