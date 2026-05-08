"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, ScanText } from "lucide-react";
import { getLocalSettings, useLocalSettings } from "@/lib/localSettings";
import { compressImage } from "@/lib/image";
import { getCheckedAt } from "@/lib/exif";
import { recognizeJapanese } from "@/lib/ocr/tesseract";
import { recognizeWithClaude } from "@/lib/ocr/claude";
import { parseShopText, type ExtractedFields } from "@/lib/ocr/parse";
import {
  resolveShopPeriod,
  type ShopPhase,
} from "@/lib/shopPeriods";
import { toLocalInput } from "@/lib/utils/date";
import { Button, Field, fieldInputClass } from "@/components/ui";
import ShopPeriodPicker from "@/components/ShopPeriodPicker";

export interface PriceEntryFormValue {
  refPriceMin: string;
  refPriceMax: string;
  shopYearMonth: string;
  shopPhase: ShopPhase;
  shopAuto: boolean;
  /** Local-input (datetime-local) string. checkedAtTimeUnknown=true のときも
   *  内部表現は datetime-local 形式 ( "YYYY-MM-DDT00:00" ) で保持する。 */
  checkedAt: string;
  /** 時間不明 ( v0.27.17 ) — checked のとき input は date 型、 表示は
   *  日付のみ、 内部値は当日 00:00 に固定する。 */
  checkedAtTimeUnknown: boolean;
  priceSource: string;
}

export const EMPTY_PRICE_ENTRY_FORM: PriceEntryFormValue = {
  refPriceMin: "",
  refPriceMax: "",
  shopYearMonth: "",
  shopPhase: "ongoing",
  shopAuto: false,
  checkedAt: "",
  checkedAtTimeUnknown: false,
  // メイン画像なし時の既定。表示中のみ保存される ( showPriceSource=false の
  // ときは onSave で undefined に倒される ) 。
  priceSource: "なんおし",
};

export const PRICE_SOURCE_PRESETS: Array<{ value: string; label: string }> = [
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
  const { settings: local } = useLocalSettings();

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
      // EXIF が時刻まで持っているので timeUnknown は自動で OFF に戻す
      // ( v0.27.17 ) 。
      onChange({
        ...value,
        checkedAt: toLocalInput(checkedAt),
        checkedAtTimeUnknown: false,
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
      const ocr = getLocalSettings();
      const downscaled = await compressImage(pickedFile, {
        maxWidth: 1600,
        quality: 0.8,
      });
      let extracted: ExtractedFields = {};
      if (ocr.ocrProvider === "claude" && ocr.claudeApiKey) {
        extracted = await recognizeWithClaude(
          downscaled,
          ocr.claudeApiKey,
          ocr.claudeModel
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
    local.ocrProvider === "claude" && local.claudeApiKey
      ? `Claude API・${local.claudeModel ?? "claude-sonnet-4-6"}`
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
              className="w-full py-3 border border-dashed border-[var(--color-line-strong)] bg-white
                flex items-center justify-center gap-2 text-text/85 hover:bg-[var(--color-line-soft)]
                transition-colors duration-150 ease-out"
            >
              <ImagePlus size={20} strokeWidth={1.8} className="text-gold-deep" />
              <div className="text-left">
                <div
                  className="text-[16px]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  スクショから自動入力
                </div>
                <div className="text-[10.5px] text-muted">画像は保存されません</div>
              </div>
            </button>
          ) : (
            <>
              <div className="border border-[var(--color-line)] bg-white flex items-center gap-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="読み込み中の画像"
                  className="w-16 h-16 object-cover shrink-0"
                />
                <div className="min-w-0 flex-1 text-[12px] text-text/85">
                  <div
                    className="truncate text-[14px]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
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
                <div className="text-[12px] text-text/85 bg-[var(--color-danger-soft)] border border-[var(--color-danger)] px-2.5 py-1.5">
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
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type={value.checkedAtTimeUnknown ? "date" : "datetime-local"}
            value={
              value.checkedAtTimeUnknown
                ? value.checkedAt.slice(0, 10)
                : value.checkedAt
            }
            onChange={(e) =>
              onChange({
                ...value,
                checkedAt: value.checkedAtTimeUnknown
                  ? `${e.target.value}T00:00`
                  : e.target.value,
              })
            }
            className={`${fieldInputClass} flex-1 min-w-[10rem]`}
          />
          <label
            className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text)] cursor-pointer select-none"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <input
              type="checkbox"
              checked={value.checkedAtTimeUnknown}
              onChange={(e) => {
                const next = e.target.checked;
                // ON にするとき: 既存の datetime-local の日付 portion だけ
                // 残して時刻を 00:00 に。 OFF のとき: 値はそのまま ( ユーザー
                // が時刻を入力できるように ) 。
                const nextCheckedAt = next
                  ? `${value.checkedAt.slice(0, 10) || ""}T00:00`
                  : value.checkedAt;
                onChange({
                  ...value,
                  checkedAtTimeUnknown: next,
                  checkedAt: nextCheckedAt,
                });
              }}
              className="w-4 h-4 accent-[var(--color-gold-deep)]"
            />
            時間不明
          </label>
        </div>
      </Field>

      <ShopPeriodPicker
        yearMonth={value.shopYearMonth}
        phase={value.shopPhase}
        auto={value.shopAuto}
        onChange={({ yearMonth, phase }) =>
          onChange({
            ...value,
            shopYearMonth: yearMonth,
            shopPhase: phase,
            shopAuto: false,
          })
        }
      />

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
