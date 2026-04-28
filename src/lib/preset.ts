import type { CropRect } from "./image";

/**
 * Crop presets that match the standard リヴリー shop screenshot taken on a
 * 1179×2556 device. Currently applied whenever the source image is exactly
 * 1179×2556 px regardless of the top-left pixel.
 */
export const PRESETS = {
  width: 1179,
  height: 2556,
  icon: { x: 388, y: 835, w: 402, h: 405 } as CropRect,
  main: { x: 0, y: 742, w: 1179, h: 1814 } as CropRect,
};

/**
 * Returns the preset rectangles for the source image when its dimensions
 * match the reference layout; otherwise returns null.
 */
export async function detectPresetCrops(
  source: Blob
): Promise<{ icon: CropRect; main: CropRect } | null> {
  const bitmap = await createImageBitmap(source);
  try {
    if (bitmap.width !== PRESETS.width || bitmap.height !== PRESETS.height) {
      return null;
    }
    return { icon: PRESETS.icon, main: PRESETS.main };
  } finally {
    bitmap.close();
  }
}
