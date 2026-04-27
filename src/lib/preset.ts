import type { CropRect } from "./image";

/**
 * Crop presets that match the standard リヴリー shop screenshot taken on a
 * 1179×2556 device. The presets are applied only when:
 *   - The image is exactly 1179×2556 px, AND
 *   - The top-left pixel is NOT the dark gold tone (#77663e) used by some
 *     other UI states; that pixel signals a different layout the presets
 *     would not align with.
 */
export const PRESETS = {
  width: 1179,
  height: 2556,
  excludeTopLeftHex: "#77663e",
  icon: { x: 388, y: 835, w: 402, h: 405 } as CropRect,
  main: { x: 0, y: 742, w: 1179, h: 1814 } as CropRect,
};

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toLowerCase();
}

/**
 * Returns the preset rectangles for the source image when its dimensions and
 * top-left pixel pass the conditions above; otherwise returns null.
 */
export async function detectPresetCrops(
  source: Blob
): Promise<{ icon: CropRect; main: CropRect } | null> {
  const bitmap = await createImageBitmap(source);
  try {
    if (bitmap.width !== PRESETS.width || bitmap.height !== PRESETS.height) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, 1, 1, 0, 0, 1, 1);
    const px = ctx.getImageData(0, 0, 1, 1).data;
    const hex = rgbToHex(px[0], px[1], px[2]);
    if (hex === PRESETS.excludeTopLeftHex) return null;
    return { icon: PRESETS.icon, main: PRESETS.main };
  } finally {
    bitmap.close();
  }
}
