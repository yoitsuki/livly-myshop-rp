import type { CropRect } from "./image";

export type ColorCondition = "none" | "match" | "exclude";

/** Default HSV tolerance applied when a preset doesn't specify one. */
export const DEFAULT_COLOR_TOLERANCE = 25;

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
  /**
   * Allowed HSV difference when comparing topLeftHex with the image's
   * top-left pixel. Compared as max(angular dH in degrees, dS, dV) where
   * S/V are on a 0–100 scale. 0 = exact match. Defaults to 25.
   */
  colorTolerance?: number;
  icon: CropRect;
  /** Optional: presets without a main rect skip main-image registration. */
  main?: CropRect;
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
    colorTolerance: DEFAULT_COLOR_TOLERANCE,
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
    colorTolerance: DEFAULT_COLOR_TOLERANCE,
    icon: { x: 47, y: 821, w: 172, h: 174 },
    main: { x: 0, y: 742, w: 1179, h: 1814 },
  },
];

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toLowerCase();
}

interface HSV {
  h: number;
  s: number;
  v: number;
}

function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return { h, s, v };
}

function hexToHsv(hex: string): HSV | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return rgbToHsv((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
}

/** Max-component HSV distance: max of angular dH (deg), |dS|, |dV|. */
function hsvMaxDelta(a: HSV, b: HSV): number {
  const rawDh = Math.abs(a.h - b.h);
  const dH = Math.min(rawDh, 360 - rawDh);
  const dS = Math.abs(a.s - b.s);
  const dV = Math.abs(a.v - b.v);
  return Math.max(dH, dS, dV);
}

/**
 * Returns the first preset whose conditions match the source image, plus the
 * resulting icon/main rectangles. `null` when no preset matches.
 */
export async function findMatchingPreset(
  source: Blob,
  presets: CropPreset[]
): Promise<{ preset: CropPreset; icon: CropRect; main?: CropRect } | null> {
  if (presets.length === 0) return null;
  const bitmap = await createImageBitmap(source);
  let topLeftHsv: HSV | null = null;
  try {
    if (presets.some((p) => p.colorMode !== "none")) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, 1, 1, 0, 0, 1, 1);
        const px = ctx.getImageData(0, 0, 1, 1).data;
        topLeftHsv = rgbToHsv(px[0], px[1], px[2]);
      }
    }

    for (const preset of presets) {
      if (bitmap.width !== preset.width || bitmap.height !== preset.height) continue;
      if (preset.colorMode !== "none" && preset.topLeftHex) {
        const targetHsv = hexToHsv(preset.topLeftHex);
        if (!targetHsv || !topLeftHsv) continue;
        const tolerance = preset.colorTolerance ?? DEFAULT_COLOR_TOLERANCE;
        const within = hsvMaxDelta(topLeftHsv, targetHsv) <= tolerance;
        if (preset.colorMode === "match" && !within) continue;
        if (preset.colorMode === "exclude" && within) continue;
      }
      return { preset, icon: preset.icon, main: preset.main };
    }
    return null;
  } finally {
    bitmap.close();
  }
}

export function describePreset(p: CropPreset): string {
  const mainNote = p.main ? "" : " ・ メイン無し";
  if (p.colorMode === "none") {
    return `${p.width}×${p.height} ・ 色条件なし${mainNote}`;
  }
  const tol = p.colorTolerance ?? DEFAULT_COLOR_TOLERANCE;
  const tolText = ` (HSV±${tol})`;
  const cond =
    p.colorMode === "match"
      ? `左上が ${p.topLeftHex ?? "?"} の時のみ${tolText}`
      : `左上が ${p.topLeftHex ?? "?"} 以外の時のみ${tolText}`;
  return `${p.width}×${p.height} ・ ${cond}${mainNote}`;
}

/** Sample the source image's top-left pixel as a #rrggbb string. */
export async function sampleTopLeftHex(source: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, 1, 1, 0, 0, 1, 1);
    const px = ctx.getImageData(0, 0, 1, 1).data;
    return rgbToHex(px[0], px[1], px[2]);
  } finally {
    bitmap.close();
  }
}

export function newPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
