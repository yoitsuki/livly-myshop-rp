"use client";

import { Sparkles } from "lucide-react";
import {
  formatRoundDateRange,
  formatShopPeriod,
  SHOP_ROUNDS,
  type ShopPhase,
} from "@/lib/shopPeriods";
import { Field, inputClass } from "@/components/ui";

export interface ShopPeriodChange {
  yearMonth: string;
  phase: ShopPhase;
}

export interface ShopPeriodPickerProps {
  yearMonth: string;
  phase: ShopPhase;
  /** EXIF / lastModified などから自動判定された状態のとき true。
   *  ラベル右に Sparkles "画像から自動判定" を出す。 */
  auto: boolean;
  /** !auto のときに代わりに「手動選択」と出すか。
   *  register form 側で「メイン画像が無いから自動判定が走らない」シグナルとして使う。
   *  PriceEntryForm 側はそもそも手動選択前提なので未指定 ( false ) で OK。 */
  showManualHint?: boolean;
  /** select の枠を強調するか。 register form では auto && !!mainBlob の
   *  ときだけ true を渡す。 */
  highlight?: boolean;
  onChange: (next: ShopPeriodChange) => void;
}

/**
 * /register form と /items/[id]/prices/* の編集画面で共通利用する
 * 「マイショップ時期」セレクト ( v0.27.15 で抽出 ) 。 元は register/page.tsx の
 * ShopPeriodField と PriceEntryForm.tsx 内の <Field label="マイショップ時期">
 * ブロックの 2 箇所に重複していて、 同じ option text の更新を片方忘れる
 * 不具合 ( v0.27.13 → v0.27.14 ) が起きたため一本化。
 */
export default function ShopPeriodPicker({
  yearMonth,
  phase,
  auto,
  showManualHint,
  highlight,
  onChange,
}: ShopPeriodPickerProps) {
  const adornment = auto ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-gold-deep font-medium normal-case tracking-normal">
      <Sparkles size={11} />
      画像から自動判定
    </span>
  ) : showManualHint ? (
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
          onChange={(e) =>
            onChange({ yearMonth: e.target.value, phase })
          }
          className={`${inputClass({ highlighted: highlight, fullWidth: false })} flex-1 min-w-[10rem]`}
        >
          <option value="">未指定</option>
          {SHOP_ROUNDS.map((r) => (
            <option key={r.yearMonth} value={r.yearMonth}>
              {r.yearMonth} (第{r.roundNumber}回) {formatRoundDateRange(r)}
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
                onClick={() => onChange({ yearMonth, phase: p })}
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
