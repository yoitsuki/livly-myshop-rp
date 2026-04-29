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
import { Button, Field, inputClass } from "@/components/ui";

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
    <div className="pt-3 pb-8 space-y-5">
      <Field label="プリセット名" required>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="例: 通常レイアウト"
          className={`${inputClass()} font-bold text-[15px]`}
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
        <div className="space-y-2">
          <div className="inline-flex bg-white border border-[var(--color-line)] p-0.5 flex-wrap">
            {COLOR_MODES.map((m) => {
              const active = draft.colorMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setDraft({ ...draft, colorMode: m.value })}
                  className={`px-3 h-9 text-[12px] transition-colors ${
                    active
                      ? "bg-gold text-white font-bold"
                      : "text-text/70 hover:text-text"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
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
                  className={`${inputClass({ fullWidth: false })} font-mono tabular-nums flex-1 min-w-0`}
                />
                <span
                  className="w-10 h-11 border border-[var(--color-line)] shrink-0"
                  style={{ backgroundColor: draft.topLeftHex ?? "#ffffff" }}
                  aria-hidden
                />
              </div>
              <div className="flex items-center gap-2">
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
                  className={`${inputClass({ fullWidth: false })} w-20 shrink-0 text-center tabular-nums`}
                />
                <span className="text-[10.5px] text-muted leading-tight">
                  H/S/V 各成分の差がこの値以内なら一致 (既定 25)
                </span>
              </div>
            </div>
          )}
        </div>
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
        className="text-[12px] text-muted hover:text-text inline-flex items-center gap-1"
      >
        <RotateCcw size={12} />
        既定値 (1179×2556) に戻す
      </button>

      {error && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)] px-3 py-2 text-[13px] text-text">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link href={cancelHref} className="flex-1">
          <Button variant="secondary" size="lg" fullWidth>
            キャンセル
          </Button>
        </Link>
        <div className="flex-[2]">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onSave}
            loading={saving}
          >
            {saving ? "保存中…" : submitLabel}
          </Button>
        </div>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={async () => {
            if (!confirm("このプリセットを削除しますか？")) return;
            await onDelete();
            router.push("/presets");
          }}
          className="text-[12px] text-[var(--color-danger)] hover:underline"
        >
          このプリセットを削除
        </button>
      )}
    </div>
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
        className={`${inputClass()} tabular-nums`}
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
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold-deep px-1">
        {legend}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {(["x", "y", "w", "h"] as const).map((k) => (
          <label key={k} className="block">
            <span className="text-[10px] text-muted px-1">{k}</span>
            <input
              type="number"
              inputMode="numeric"
              value={rect[k]}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n))
                  onChange({ [k]: Math.max(0, Math.round(n)) });
              }}
              className={`${inputClass()} h-9 px-2 tabular-nums text-[12px]`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
