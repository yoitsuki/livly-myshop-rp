"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Home } from "lucide-react";
import { useItems, useSettings, useTags } from "@/lib/firebase/hooks";
import { getSettings } from "@/lib/firebase/repo";
import { useLocalSettings } from "@/lib/localSettings";
import { describePreset, type CropPreset } from "@/lib/preset";
import { Button, Field, fieldInputClass, Toast } from "@/components/ui";

const CLAUDE_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

export default function SettingsPage() {
  const cloudSettings = useSettings();
  useEffect(() => {
    if (cloudSettings === undefined) return;
    // Seed the singleton + cropPresets on first read.
    getSettings().catch(() => undefined);
  }, [cloudSettings]);

  const { settings: local, patch: patchLocal } = useLocalSettings();

  const items = useItems();
  const tags = useTags();
  const itemCount = items?.length ?? 0;
  const tagCount = tags?.length ?? 0;

  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const updateLocal = (patch: Parameters<typeof patchLocal>[0]) => {
    patchLocal(patch);
    flashSaved();
  };

  const apiKeyValue = keyDraft ?? local.claudeApiKey ?? "";

  return (
    <div className="pt-3 pb-8 space-y-8">
      <Section title="OCR エンジン" hint="画像から文字を抽出する方法を選びます。">
        <div className="grid grid-cols-2 gap-2">
          <RadioCard
            active={local.ocrProvider === "tesseract"}
            onClick={() => updateLocal({ ocrProvider: "tesseract" })}
            label="Tesseract"
            sub="ブラウザ内 / キー不要 / やや遅い"
          />
          <RadioCard
            active={local.ocrProvider === "claude"}
            onClick={() => updateLocal({ ocrProvider: "claude" })}
            label="Claude Vision"
            sub="高精度 / API キー必須"
          />
        </div>
      </Section>

      <Section title="Claude API" hint="Claude Vision を使う場合に設定します。">
        <Field label="API キー (sk-ant-…)">
          <div
            className={`${fieldInputClass} flex items-center gap-1 px-2 focus-within:border-gold focus-within:shadow-[var(--shadow-focus)]`}
          >
            <input
              type={showKey ? "text" : "password"}
              value={apiKeyValue}
              onChange={(e) => setKeyDraft(e.target.value)}
              onBlur={() => {
                if (keyDraft !== undefined) {
                  updateLocal({ claudeApiKey: keyDraft.trim() || undefined });
                  setKeyDraft(undefined);
                }
              }}
              placeholder="sk-ant-…"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] tabular-nums text-text"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={() => setShowKey((s) => !s)}
              className="p-1.5 text-muted hover:text-text transition-colors"
              aria-label={showKey ? "キーを隠す" : "キーを表示"}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <Field label="モデル">
          <select
            value={local.claudeModel ?? "claude-sonnet-4-6"}
            onChange={(e) => updateLocal({ claudeModel: e.target.value })}
            className={fieldInputClass}
          >
            {CLAUDE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-[11px] text-muted px-1 leading-relaxed">
          キーは端末内 (localStorage) のみに保存されます。送信時は Next.js
          の Route Handler 経由で Anthropic API に転送します。
        </p>
      </Section>

      <Section title="件数">
        <div className="flex items-baseline gap-3 tabular-nums px-1 text-text/85">
          <span>
            <span
              className="text-[20px] text-text"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {itemCount}
            </span>
            <span className="text-muted text-[11px] ml-0.5">items</span>
          </span>
          <span className="text-[var(--color-line-strong)]">/</span>
          <span>
            <span
              className="text-[20px] text-text"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {tagCount}
            </span>
            <span className="text-muted text-[11px] ml-0.5">tags</span>
          </span>
        </div>
      </Section>

      <Section
        title="切り抜きプリセット"
        hint="画像取り込み時のクロップ範囲を保存します。詳細は専用画面で編集します。"
      >
        <CropPresetSummary presets={cloudSettings?.cropPresets ?? []} />
        <Link
          href="/presets"
          className="inline-flex items-center gap-1 text-[12px] text-gold-deep hover:underline"
        >
          プリセット管理を開く →
        </Link>
      </Section>

      <Link href="/" className="block">
        <Button variant="secondary" size="lg" fullWidth icon={<Home size={16} />}>
          ホームに戻る
        </Button>
      </Link>

      <Toast open={saved} message="保存しました" />

    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <h3 className="text-[10px] font-medium tracking-[0.18em] uppercase text-gold-deep">
          {title}
        </h3>
        {hint && (
          <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{hint}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function RadioCard({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left border p-3 transition-all duration-150 ease-out ${
        active
          ? "border-gold-deep bg-white shadow-[var(--shadow-focus)]"
          : "border-[var(--color-line)] bg-white hover:border-[var(--color-line-strong)]"
      }`}
    >
      <div
        className={`text-[16px] ${active ? "text-gold-deep" : "text-text"}`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {label}
      </div>
      <div className="text-[10.5px] text-muted leading-tight mt-0.5">{sub}</div>
    </button>
  );
}

function CropPresetSummary({ presets }: { presets: CropPreset[] }) {
  if (presets.length === 0) {
    return (
      <p className="text-[12px] text-muted px-1">
        登録済みプリセットはありません。
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
      {presets.map((p) => (
        <li key={p.id} className="px-1 py-2">
          <div
            className="text-[15px] text-text"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {p.name}
          </div>
          <div className="text-[10.5px] text-muted">{describePreset(p)}</div>
        </li>
      ))}
    </ul>
  );
}
