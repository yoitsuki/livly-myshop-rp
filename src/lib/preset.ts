import type { CropRect } from "./image";

export type ColorCondition = "none" | "match" | "exclude";

/** Settings-backed preset configuration. */
export interface CropPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Color condition mode for the source image's top-left pixel. */
  colorMode: ColorCondition;
  /** Hex like "#77663e" (lower-cased). Used when colorMode !== "none". */
  topLeftHex?: string;
  icon: CropRect;
  main: CropRect;
}

/** Seed presets — newest first. */
export const SEED_PRESETS: CropPreset[] = [
  {
    id: "default-standard",
    name: "通常レイアウト (1179×2556)",
    width: 1179,
    height: 2556,
    colorMode: "exclude",
    topLeftHex: "#77663e",
    icon: { x: 388, y: 835, w: 402, h: 405 },
    main: { x: 0, y: 742, w: 1179, h: 1814 },
  },
  {
    id: "default-brown-header",
    name: "茶ヘッダレイアウト",
    width: 1179,
    height: 2556,
    colorMode: "match",
    topLeftHex: "#77663e",
    icon: { x: 47, y: 821, w: 172, h: 174 },
    main: { x: 0, y: 742, w: 1179, h: 1814 },
  },
];

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toLowerCase();
}

/**
 * Returns the first preset whose conditions match the source image, plus the
 * resulting icon/main rectangles. `null` when no preset matches.
 */
export async function findMatchingPreset(
  source: Blob,
  presets: CropPreset[]
): Promise<{ preset: CropPreset; icon: CropRect; main: CropRect } | null> {
  if (presets.length === 0) return null;
  const bitmap = await createImageBitmap(source);
  let topLeftHex: string | null = null;
  try {
    // Pre-compute top-left only if any preset needs it, but cheap enough to do once.
    if (presets.some((p) => p.colorMode !== "none")) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, 1, 1, 0, 0, 1, 1);
        const px = ctx.getImageData(0, 0, 1, 1).data;
        topLeftHex = rgbToHex(px[0], px[1], px[2]);
      }
    }

    for (const preset of presets) {
      if (bitmap.width !== preset.width || bitmap.height !== preset.height) continue;
      if (preset.colorMode !== "none" && preset.topLeftHex) {
        const want = preset.topLeftHex.toLowerCase();
        const same = topLeftHex === want;
        if (preset.colorMode === "match" && !same) continue;
        if (preset.colorMode === "exclude" && same) continue;
      }
      return { preset, icon: preset.icon, main: preset.main };
    }
    return null;
  } finally {
    bitmap.close();
  }
}

export function describePreset(p: CropPreset): string {
  const cond =
    p.colorMode === "none"
      ? "色条件なし"
      : p.colorMode === "match"
        ? `左上が ${p.topLeftHex ?? "?"} の時のみ`
        : `左上が ${p.topLeftHex ?? "?"} 以外の時のみ`;
  return `${p.width}×${p.height} ・ ${cond}`;
}

export function newPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
