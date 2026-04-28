import type { CropRect } from "./image";

/** Settings-backed preset configuration. */
export interface CropPresetConfig {
  width: number;
  height: number;
  /** Lowercase hex like "#77663e". Top-left pixel matching this is excluded. */
  excludeTopLeftHex?: string;
  icon: CropRect;
  main: CropRect;
}

/**
 * Built-in default preset for the standard 1179×2556 リヴリー shop screenshot.
 * The user can override these from the settings page.
 */
export const DEFAULT_CROP_PRESET: CropPresetConfig = {
  width: 1179,
  height: 2556,
  excludeTopLeftHex: "#77663e",
  icon: { x: 388, y: 835, w: 402, h: 405 },
  main: { x: 0, y: 742, w: 1179, h: 1814 },
};

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toLowerCase();
}

/**
 * Returns the preset rectangles for the source image when its dimensions
 * match `config.width × config.height` AND its top-left pixel is not the
 * configured exclusion color (if any).
 */
export async function detectPresetCrops(
  source: Blob,
  config: CropPresetConfig
): Promise<{ icon: CropRect; main: CropRect } | null> {
  const bitmap = await createImageBitmap(source);
  try {
    if (bitmap.width !== config.width || bitmap.height !== config.height) {
      return null;
    }
    if (config.excludeTopLeftHex) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, 1, 1, 0, 0, 1, 1);
      const px = ctx.getImageData(0, 0, 1, 1).data;
      const hex = rgbToHex(px[0], px[1], px[2]);
      if (hex === config.excludeTopLeftHex.toLowerCase()) return null;
    }
    return { icon: config.icon, main: config.main };
  } finally {
    bitmap.close();
  }
}
