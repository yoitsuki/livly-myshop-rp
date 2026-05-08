"use client";

import { ClipboardPaste, X } from "lucide-react";

export interface InputActionsProps {
  /** クリア時に呼ばれる ( 通常は parent state を空にする ) 。 */
  onClear: () => void;
  /** ペースト成功時に呼ばれる。 digitsOnly=true のときは非数値を除去した
   *  文字列が渡される。 */
  onPaste: (text: string) => void;
  /** 数値 input 用 ( 最低販売価格 等 ) — pasted text から非数値を除去する。 */
  digitsOnly?: boolean;
  /** 入力が空のときクリアを disable する。 */
  hasValue?: boolean;
}

/**
 * 各種テキスト/数値 input の **右内側に重ねて表示する**「ペースト 📋 /
 * クリア × 」ゴーストボタン ( v0.27.20 で外付け box → 内側オーバーレイ
 * に変更 ) 。 呼出側は `<div className="relative">` で input をラップし、
 * input の className に `pr-20` ( ボタン分 = 64px ) を足す。 並びは
 * 左ペースト / 右クリアで、 入力末端に × が来る形 ( v0.27.19 ) 。
 */
export default function InputActions({
  onClear,
  onPaste,
  digitsOnly,
  hasValue = true,
}: InputActionsProps) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onPaste(digitsOnly ? text.replace(/[^\d]/g, "") : text);
    } catch {
      // Clipboard read can fail ( permission denied / unsupported ) 。
      // 静かに無視 — ユーザーが手動入力するだけ。
    }
  };
  return (
    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
      <button
        type="button"
        onClick={handlePaste}
        aria-label="ペースト"
        tabIndex={-1}
        className="w-8 h-8 inline-flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-line-soft)] transition-colors"
        style={{ borderRadius: 0 }}
      >
        <ClipboardPaste size={14} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={!hasValue}
        aria-label="クリア"
        tabIndex={-1}
        className="w-8 h-8 inline-flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-line-soft)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        style={{ borderRadius: 0 }}
      >
        <X size={14} strokeWidth={1.6} />
      </button>
    </div>
  );
}
