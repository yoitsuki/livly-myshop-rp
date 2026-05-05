"use client";

import { getSettings, patchSettings } from "@/lib/firebase/repo";
import { type CropPreset } from "@/lib/preset";
import PresetForm from "@/components/PresetForm";

export default function NewPresetPage() {
  return (
    <PresetForm
      submitLabel="追加"
      cancelHref="/presets"
      onSubmit={async (next: CropPreset) => {
        const settings = await getSettings();
        const list = settings.cropPresets ?? [];
        await patchSettings({ cropPresets: [...list, next] });
      }}
    />
  );
}
