"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import type { CropRect } from "@/lib/image";
import {
  DEFAULT_COLOR_TOLERANCE,
  newPresetId,
  SEED_PRESETS,
  type ColorCondition,
  type CropPreset,
} from "@/lib/preset";

const COLOR_MODES: Array<{ value: ColorCondition; label: string }> = [
  { value: "none", label: "なし" },
  { value: "match", label: "左上の色が一致する時のみ" },
  { value: "exclude", label: "左上の色が一致しない時のみ" },
];

interface Props {
  initial?: CropPreset;
  /** Returns the saved preset to the caller. */
  onSubmit: (next: CropPreset) => Promise<void> | void;
  /** Optional delete action shown in edit mode. */
  onDelete?: () => Promise<void> | void;
  cancelHref: string;
  submitLabel: string;
}

export default function PresetForm({
  initial,
  onSubmit,
  onDelete,
  cancelHref,
  submitLabel,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<CropPreset>(
    initial ?? {
      id: newPresetId(),
      name: "",
      width: 1179,
      height: 2556,
      colorMode: "exclude",
      topLeftHex: "#77663e",
      colorTolerance: DEFAULT_COLOR_TOLERANCE,
      icon: { x: 388, y: 835, w: 402, h: 405 },
      main: { x: 0, y: 742, w: 1179, h: 1814 },
    }
  );
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const setRect = (which: "icon" | "main", patch: Partial<CropRect>) => {
    setDraft({ ...draft, [which]: { ...draft[which], ...patch } });
  };

  const onSave = async () => {
    if (!draft.name.trim()) {
      setError("名前を入力してください");
      return;
    }
    if (draft.colorMode !== "none" && !draft.topLeftHex) {
      setError("色条件を有効にする場合は HEX を入力してください");
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await onSubmit({
        ...draft,
        name: draft.name.trim(),
        topLeftHex: draft.topLeftHex
          ? draft.topLeftHex.trim().toLowerCase()
          : undefined,
      });
      router.push("/presets");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setSaving(false);
    }
  };

  const onResetDefaults = () => {
    const seed = SEED_PRESETS[0];
    setDraft({
      ...draft,
      width: seed.width,
      height: seed.height,
      colorMode: seed.colorMode,
      topLeftHex: seed.topLeftHex,
      colorTolerance: seed.colorTolerance ?? DEFAULT_COLOR_TOLERANCE,
      icon: { ...seed.icon },
      main: { ...seed.main },
    });
  };

  return (
    <div className="pt-3 pb-6 space-y-4">
      <Field label="プリセット名" required>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="例: 通常レイアウト"
          className="w-full bg-transparent outline-none text-[15px] font-bold text-text"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="幅 (px)"
          value={draft.width}
          onChange={(v) => setDraft({ ...draft, width: v })}
        />
        <NumberField
          label="高さ (px)"
          value={draft.height}
          onChange={(v) => setDraft({ ...draft, height: v })}
        />
      </div>

      <Field label="色条件">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {COLOR_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setDraft({ ...draft, colorMode: m.value })}
              className={`px-2.5 py-1 rounded-full text-[12px] border transition-colors ${
                draft.colorMode === m.value
                  ? "bg-gold/15 border-gold text-gold-deep font-bold"
                  : "bg-cream border-beige text-text/70"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {draft.colorMode !== "none" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft.topLeftHex ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    topLeftHex: e.target.value.trim() || undefined,
                  })
                }
                placeholder="#77663e"
                className="flex-1 bg-transparent outline-none text-[13px] font-mono tabular-nums"
              />
              <span
                className="w-6 h-6 rounded-full border border-beige-deep shrink-0"
                style={{ backgroundColor: draft.topLeftHex ?? "#ffffff" }}
                aria-hidden
              />
            </div>
            <div className="flex items-center gap-2 border-t border-beige/60 pt-2">
              <span className="text-[11px] text-muted shrink-0">
                許容誤差 (HSV)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={180}
                value={draft.colorTolerance ?? DEFAULT_COLOR_TOLERANCE}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setDraft({
                    ...draft,
                    colorTolerance: Math.max(0, Math.min(180, Math.round(n))),
                  });
                }}
                className="w-16 bg-beige/40 rounded px-1.5 py-1 outline-none text-[12px] tabular-nums text-text"
              />
              <span className="text-[10.5px] text-muted leading-tight">
                H/S/V 各成分の差がこの値以内なら一致と判定 (既定 25)
              </span>
            </div>
          </div>
        )}
      </Field>

      <RectFieldset
        legend="アイコン (icon)"
        rect={draft.icon}
        onChange={(p) => setRect("icon", p)}
      />
      <RectFieldset
        legend="メイン (main)"
        rect={draft.main}
        onChange={(p) => setRect("main", p)}
      />

      <button
        type="button"
        onClick={onResetDefaults}
        className="text-[12px] text-muted underline inline-flex items-center gap-1"
      >
        <RotateCcw size={12} />
        既定値 (1179×2556) に戻す
      </button>

      {error && (
        <div className="rounded-xl bg-pink/40 border border-pink px-3 py-2 text-[13px]">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link
          href={cancelHref}
          className="flex-1 py-3 rounded-full bg-beige/70 text-text/80 font-bold text-center"
        >
          キャンセル
        </Link>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-[2] py-3 rounded-full bg-gold text-white font-bold disabled:opacity-50 active:bg-gold-deep"
        >
          {saving ? "保存中…" : submitLabel}
        </button>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={async () => {
            if (!confirm("このプリセットを削除しますか？")) return;
            await onDelete();
            router.push("/presets");
          }}
          className="text-[12px] text-pink/90 hover:text-pink underline"
        >
          このプリセットを削除
        </button>
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(0, Math.round(n)));
        }}
        className="w-full bg-transparent outline-none text-[13px] tabular-nums"
      />
    </Field>
  );
}

function RectFieldset({
  legend,
  rect,
  onChange,
}: {
  legend: string;
  rect: CropRect;
  onChange: (patch: Partial<CropRect>) => void;
}) {
  return (
    <fieldset className="border border-beige rounded-xl px-2 py-1.5 bg-cream">
      <legend className="px-1 text-[11px] text-muted font-bold">{legend}</legend>
      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
        {(["x", "y", "w", "h"] as const).map((k) => (
          <label key={k} className="text-[11px] text-muted">
            {k}
            <input
              type="number"
              inputMode="numeric"
              value={rect[k]}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onChange({ [k]: Math.max(0, Math.round(n)) });
              }}
              className="w-full bg-beige/40 rounded px-1.5 py-1 outline-none text-[12px] tabular-nums text-text"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
