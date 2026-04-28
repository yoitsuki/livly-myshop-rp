"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Eye, EyeOff, Home } from "lucide-react";
import {
  db,
  getSettings,
  patchSettings,
  type AppSettings,
} from "@/lib/db";

const DEFAULT_SETTINGS: AppSettings = {
  id: "singleton",
  ocrProvider: "tesseract",
  claudeModel: "claude-sonnet-4-6",
};

const CLAUDE_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

export default function SettingsPage() {
  const stored = useLiveQuery(() => db().settings.get("singleton"), []);
  const settings: AppSettings | undefined = stored ?? DEFAULT_SETTINGS;
  useEffect(() => {
    // Lazily seed the singleton row so subsequent updates have a target.
    if (stored === undefined) return; // still loading
    if (stored === null) {
      getSettings().catch(() => undefined);
    }
  }, [stored]);
  const itemCount = useLiveQuery(() => db().items.count(), [], 0);
  const tagCount = useLiveQuery(() => db().tags.count(), [], 0);

  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [storage, setStorage] = useState<{
    usage: number;
    quota: number;
  } | null>(null);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.storage ||
      !navigator.storage.estimate
    )
      return;
    navigator.storage.estimate().then((est) => {
      if (est.usage != null && est.quota != null) {
        setStorage({ usage: est.usage, quota: est.quota });
      }
    });
  }, [itemCount]);

  if (!settings) {
    return <div className="pt-6 text-center text-muted">読み込み中…</div>;
  }

  const update = async (patch: Partial<AppSettings>) => {
    await patchSettings(patch);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const apiKeyValue = keyDraft ?? settings.claudeApiKey ?? "";

  return (
    <div className="pt-3 pb-6 space-y-4">
      <Section title="OCR エンジン" hint="画像から文字を抽出する方法を選びます。">
        <div className="grid grid-cols-2 gap-2">
          <RadioCard
            active={settings.ocrProvider === "tesseract"}
            onClick={() => update({ ocrProvider: "tesseract" })}
            label="Tesseract"
            sub="ブラウザ内 / キー不要 / やや遅い"
          />
          <RadioCard
            active={settings.ocrProvider === "claude"}
            onClick={() => update({ ocrProvider: "claude" })}
            label="Claude Vision"
            sub="高精度 / API キー必須"
          />
        </div>
      </Section>

      <Section title="Claude API" hint="Claude Vision を使う場合に設定します。">
        <Field label="API キー (sk-ant-...)">
          <div className="flex items-center gap-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKeyValue}
              onChange={(e) => setKeyDraft(e.target.value)}
              onBlur={() => {
                if (keyDraft !== undefined) {
                  update({ claudeApiKey: keyDraft.trim() || undefined });
                  setKeyDraft(undefined);
                }
              }}
              placeholder="sk-ant-..."
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] tabular-nums"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={() => setShowKey((s) => !s)}
              className="p-1.5 text-muted"
              aria-label={showKey ? "キーを隠す" : "キーを表示"}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <Field label="モデル">
          <select
            value={settings.claudeModel ?? "claude-sonnet-4-6"}
            onChange={(e) => update({ claudeModel: e.target.value })}
            className="w-full bg-transparent outline-none text-[13px]"
          >
            {CLAUDE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-[11px] text-muted px-1">
          キーは端末内 (IndexedDB) のみに保存されます。送信時は Next.js の Route Handler 経由で Anthropic API に転送します。
        </p>
      </Section>

      <Section title="ストレージ">
        <div className="space-y-1 text-[13px] text-text/85">
          <div>
            登録アイテム <span className="font-bold tabular-nums">{itemCount}</span> 件
            ・タグ <span className="font-bold tabular-nums">{tagCount}</span> 件
          </div>
          {storage && (
            <div className="text-[12px] text-muted">
              使用容量{" "}
              <span className="tabular-nums">{formatBytes(storage.usage)}</span>{" "}
              / 利用可能{" "}
              <span className="tabular-nums">{formatBytes(storage.quota)}</span>
              <div className="mt-1 h-1.5 rounded-full bg-beige/60 overflow-hidden">
                <div
                  className="h-full bg-gold/70"
                  style={{
                    width: `${Math.min(100, (storage.usage / storage.quota) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="クラウド連携 (将来)" hint="Drive バックアップは未実装です。">
        <p className="text-[12px] text-muted px-1 leading-relaxed">
          現時点では画像とメタデータをすべて端末内 (IndexedDB)
          に保存しています。
          <br />
          後ほど Google Drive バックアップを追加予定です。
        </p>
      </Section>

      <Link
        href="/"
        className="mt-2 w-full py-3 rounded-full bg-beige/70 text-text/85 font-bold text-center inline-flex items-center justify-center gap-1.5"
      >
        <Home size={16} />
        ホームに戻る
      </Link>

      {saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-text text-cream text-[12px] shadow-lg">
          保存しました
        </div>
      )}
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
    <section className="rounded-2xl bg-cream border border-beige p-3 space-y-2">
      <div>
        <h3 className="text-[14px] font-bold text-text">{title}</h3>
        {hint && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
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
      <div className="text-[11px] text-muted font-bold mb-0.5 px-1">{label}</div>
      <div className="rounded-lg bg-beige/40 border border-beige px-3 py-2">
        {children}
      </div>
    </label>
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
      className={`text-left rounded-xl border p-2.5 transition-colors ${
        active
          ? "border-gold bg-gold/10"
          : "border-beige bg-cream hover:bg-beige/40"
      }`}
    >
      <div className={`font-bold text-[13px] ${active ? "text-gold-deep" : "text-text"}`}>
        {label}
      </div>
      <div className="text-[10.5px] text-muted leading-tight mt-0.5">{sub}</div>
    </button>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
