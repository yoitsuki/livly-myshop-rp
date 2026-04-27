/**
 * Browser-side image processing: shrink to a max width and re-encode as JPEG.
 * Does not upscale. Always returns a fresh Blob.
 */

export interface CompressOptions {
  maxWidth: number;
  /** 0–1, JPEG quality. */
  quality: number;
  /** Background color used when flattening transparency to JPEG. */
  background?: string;
}

const DEFAULTS = {
  full: { maxWidth: 1600, quality: 0.8 },
  thumb: { maxWidth: 240, quality: 0.7 },
} satisfies Record<string, CompressOptions>;

/** Skip re-encoding if the source is already a small JPEG. */
const PASSTHROUGH_BYTES = 600 * 1024;

export async function compressImage(
  source: Blob,
  opts: CompressOptions
): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    const ratio = Math.min(1, opts.maxWidth / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * ratio));
    const h = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.fillStyle = opts.background ?? "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
        "image/jpeg",
        opts.quality
      );
    });
  } finally {
    bitmap.close();
  }
}

/**
 * Produce both the storage image and a list thumbnail.
 * Returns the source unchanged for the full image when it is already small JPEG.
 */
export async function buildStoredImages(
  source: File | Blob
): Promise<{ imageBlob: Blob; thumbBlob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(source);
  const width = bitmap.width;
  const height = bitmap.height;
  bitmap.close();

  const isJpeg = source.type === "image/jpeg" || source.type === "image/jpg";
  const imageBlob =
    isJpeg && source.size <= PASSTHROUGH_BYTES && width <= DEFAULTS.full.maxWidth
      ? source
      : await compressImage(source, DEFAULTS.full);

  const thumbBlob = await compressImage(source, DEFAULTS.thumb);

  return { imageBlob, thumbBlob, width, height };
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Crop a region (in source-image pixel coordinates) and re-encode as JPEG.
 * Optionally caps the output width.
 */
export async function cropAndEncode(
  source: Blob,
  rect: CropRect,
  opts: { maxWidth?: number; quality?: number } = {}
): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    const x = clamp(Math.round(rect.x), 0, bitmap.width);
    const y = clamp(Math.round(rect.y), 0, bitmap.height);
    const w = clamp(Math.round(rect.w), 1, bitmap.width - x);
    const h = clamp(Math.round(rect.h), 1, bitmap.height - y);

    const cap = opts.maxWidth ?? Number.POSITIVE_INFINITY;
    const ratio = Math.min(1, cap / w);
    const dw = Math.max(1, Math.round(w * ratio));
    const dh = Math.max(1, Math.round(h * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dw, dh);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, x, y, w, h, 0, 0, dw, dh);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
        "image/jpeg",
        opts.quality ?? 0.85
      );
    });
  } finally {
    bitmap.close();
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export async function getImageSize(
  source: Blob
): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(source);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
