"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Home, Plus, RotateCcw, Trash2 } from "lucide-react";
import { db, getSettings, patchSettings } from "@/lib/db";
import {
  describePreset,
  SEED_PRESETS,
  type CropPreset,
} from "@/lib/preset";
import { Button, IconButton } from "@/components/ui";

export default function PresetsPage() {
  const stored = useLiveQuery(() => db().settings.get("singleton"), []);
  const presets: CropPreset[] = stored?.cropPresets ?? [];

  const onDelete = async (id: string) => {
    const target = presets.find((p) => p.id === id);
    if (!target) return;
    if (!confirm(`プリセット「${target.name}」を削除しますか？`)) return;
    const settings = await getSettings();
    const next = (settings.cropPresets ?? []).filter((p) => p.id !== id);
    await patchSettings({ cropPresets: next });
  };

  const onResetSeeds = async () => {
    if (!confirm("プリセット一覧を初期状態に戻します。よろしいですか？")) return;
    await patchSettings({ cropPresets: SEED_PRESETS });
  };

  return (
    <div className="pt-3 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="text-[14px] font-bold text-text flex-1">
          切り抜きプリセット
        </h2>
        <Link href="/presets/new">
          <Button variant="primary" size="sm" icon={<Plus size={14} />}>
            新規追加
          </Button>
        </Link>
      </div>

      <p className="text-[11px] text-muted px-1 leading-relaxed">
        画像取り込み時に上から順に判定され、最初に条件が一致したプリセットが
        適用されます。複数のレイアウトを使い分ける場合は条件と矩形を
        それぞれ登録してください。
      </p>

      {presets.length === 0 ? (
        <div className="text-center text-muted text-[13px] mt-2 px-4 leading-relaxed">
          まだプリセットがありません。
          <br />
          上の「新規追加」から作成するか、
          <button
            onClick={onResetSeeds}
            className="text-gold-deep font-bold mx-1 hover:underline"
          >
            既定の 2 件を復元
          </button>
          できます。
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {presets.map((p) => (
            <li key={p.id} className="px-2 py-3 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-text truncate">
                  {p.name}
                </div>
                <div className="text-[11px] text-muted">{describePreset(p)}</div>
                <div className="text-[10.5px] text-muted font-mono tabular-nums mt-0.5">
                  icon ({p.icon.x},{p.icon.y},{p.icon.w}×{p.icon.h}) / main (
                  {p.main.x},{p.main.y},{p.main.w}×{p.main.h})
                </div>
              </div>
              <Link
                href={`/presets/${encodeURIComponent(p.id)}`}
                className="text-[12px] text-gold-deep font-bold hover:underline shrink-0 px-2 py-1"
              >
                編集
              </Link>
              <IconButton
                size="sm"
                onClick={() => onDelete(p.id)}
                aria-label="削除"
                className="shrink-0"
              >
                <Trash2 size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={onResetSeeds}
        className="text-[11px] text-muted hover:text-text inline-flex items-center gap-1"
      >
        <RotateCcw size={12} />
        既定の 2 件に戻す
      </button>

      <Link href="/" className="block">
        <Button variant="secondary" size="lg" fullWidth icon={<Home size={16} />}>
          ホームに戻る
        </Button>
      </Link>
    </div>
  );
}
