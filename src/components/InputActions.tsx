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
 * 各種テキスト/数値 input の右に並べる「クリア × / ペースト 📋」ボタン
 * セット ( v0.27.18 ) 。 input の `inputClass({ fullWidth: false })` を
 * `flex-1 min-w-0` で挟んだ flex container 内に並べて使う。 高さは
 * inputClass の h-11 に合わせている。
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
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={onClear}
        disabled={!hasValue}
        aria-label="クリア"
        className="w-9 h-11 inline-flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-line-soft)] border border-[var(--color-line)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        style={{ borderRadius: 0 }}
      >
        <X size={14} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={handlePaste}
        aria-label="ペースト"
        className="w-9 h-11 inline-flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-line-soft)] border border-[var(--color-line)] transition-colors"
        style={{ borderRadius: 0 }}
      >
        <ClipboardPaste size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}
