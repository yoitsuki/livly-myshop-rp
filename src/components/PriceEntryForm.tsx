"use client";

import { useRef } from "react";
import { ImagePlus, Sparkles } from "lucide-react";
import { getCheckedAt } from "@/lib/exif";
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
  minPrice: string;
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
  minPrice: "",
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
  /** Show the screenshot picker that auto-fills checkedAt + period. */
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

  const handleFile = async (file: File) => {
    const checkedAt = await getCheckedAt(file);
    const resolved = resolveShopPeriod(checkedAt);
    onChange({
      ...value,
      checkedAt: toLocalInput(checkedAt),
      shopYearMonth: resolved ? resolved.round.yearMonth : value.shopYearMonth,
      shopPhase: resolved ? resolved.phase : value.shopPhase,
      shopAuto: !!resolved,
    });
  };

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
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-beige bg-cream/60 flex items-center justify-center gap-2 text-text/85 active:bg-beige/40"
        >
          <ImagePlus size={20} strokeWidth={1.6} />
          <div className="text-left">
            <div className="text-[14px] font-bold">スクショから日時・期間を取得</div>
            <div className="text-[10.5px] text-muted">画像は保存されません</div>
          </div>
        </button>
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="最低販売価格 (GP)">
          <input
            inputMode="numeric"
            value={value.minPrice}
            onChange={(e) =>
              onChange({ ...value, minPrice: e.target.value.replace(/[^\d]/g, "") })
            }
            className="w-full bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="1800"
          />
        </Field>
        <Field label="確認日時">
          <input
            type="datetime-local"
            value={value.checkedAt}
            onChange={(e) => onChange({ ...value, checkedAt: e.target.value })}
            className="w-full bg-transparent outline-none text-[13px] text-text"
          />
        </Field>
      </div>

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
