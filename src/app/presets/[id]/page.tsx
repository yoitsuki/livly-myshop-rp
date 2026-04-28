"use client";

import { use } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getSettings, patchSettings } from "@/lib/db";
import type { CropPreset } from "@/lib/preset";
import PresetForm from "@/components/PresetForm";

export default function EditPresetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const stored = useLiveQuery(() => db().settings.get("singleton"), []);
  const presets = stored?.cropPresets ?? [];
  const preset = presets.find((p) => p.id === decodeURIComponent(id));

  if (stored === undefined) {
    return <div className="pt-6 text-center text-muted">読み込み中…</div>;
  }
  if (!preset) {
    return (
      <div className="pt-6 text-center text-muted">
        プリセットが見つかりませんでした。
        <div className="mt-3">
          <Link href="/presets" className="text-gold-deep underline">
            プリセット管理へ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PresetForm
      initial={preset}
      submitLabel="保存"
      cancelHref="/presets"
      onSubmit={async (next: CropPreset) => {
        const settings = await getSettings();
        const list = (settings.cropPresets ?? []).map((p) =>
          p.id === preset.id ? next : p
        );
        await patchSettings({ cropPresets: list });
      }}
      onDelete={async () => {
        const settings = await getSettings();
        const list = (settings.cropPresets ?? []).filter(
          (p) => p.id !== preset.id
        );
        await patchSettings({ cropPresets: list });
      }}
    />
  );
}
