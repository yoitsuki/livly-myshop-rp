import { getCheckedAt } from "@/lib/exif";
import {
  compressImage,
  cropAndEncode,
  getImageSize,
  type CropRect,
} from "@/lib/image";
import { recognizeJapanese } from "@/lib/ocr/tesseract";
import { recognizeWithClaude } from "@/lib/ocr/claude";
import { parseShopText, type ExtractedFields } from "@/lib/ocr/parse";
import { findMatchingPreset, type CropPreset } from "@/lib/preset";
import { resolveShopPeriod } from "@/lib/shopPeriods";
import { getLocalSettings } from "@/lib/localSettings";
import type { BulkEntry } from "./types";

const THUMB_MAX_W = 200;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export interface ProcessBulkOptions {
  /** Skip the OCR (Claude/Tesseract) call. Used by /register/inbox when a
   *  cached OCR result is available — basics (EXIF, preset, thumb) still run
   *  because they're cheap and the cache only covers OCR-derived fields. */
  skipOcr?: boolean;
}

/**
 * Run EXIF + preset match + OCR on a single bulk source. Returns a partial
 * BulkEntry that the caller merges into the row. OCR failure is reported via
 * the `error` field rather than throwing — preset/EXIF results are still
 * useful even when OCR didn't yield text.
 */
export async function processBulkSource(
  source: Blob,
  presets: CropPreset[],
  options: ProcessBulkOptions = {},
): Promise<Partial<BulkEntry>> {
  const result: Partial<BulkEntry> = {};

  const { width, height } = await getImageSize(source);
  result.sourceWidth = width;
  result.sourceHeight = height;

  const checkedAt = await getCheckedAt(source);
  result.checkedAt = checkedAt;
  const resolved = resolveShopPeriod(checkedAt);
  if (resolved) {
    result.shopPeriod = {
      yearMonth: resolved.round.yearMonth,
      phase: resolved.phase,
      auto: true,
    };
  }

  const matched = await findMatchingPreset(source, presets);
  if (matched) {
    Object.assign(
      result,
      applyPresetRects(matched.preset.id, matched.icon, matched.main, {
        width,
        height,
      }),
    );
    result.detectedPresetId = matched.preset.id;
    try {
      result.iconThumbDataUrl = await renderIconThumb(source, matched.icon);
    } catch {
      // thumb is best-effort — leave it absent
    }
  }

  if (options.skipOcr) return result;

  const local = getLocalSettings();
  try {
    const downscaled = await compressImage(source, {
      maxWidth: 1600,
      quality: 0.8,
    });
    let extracted: ExtractedFields = {};
    if (local.ocrProvider === "claude" && local.claudeApiKey) {
      extracted = await recognizeWithClaude(
        downscaled,
        local.claudeApiKey,
        local.claudeModel,
      );
    } else {
      const text = await recognizeJapanese(downscaled);
      extracted = parseShopText(text);
    }
    if (extracted.name) result.name = extracted.name;
    if (extracted.category) result.category = extracted.category;
    if (extracted.minPrice != null) result.minPrice = extracted.minPrice;
    if (extracted.refPriceMin != null) result.refPriceMin = extracted.refPriceMin;
    if (extracted.refPriceMax != null) result.refPriceMax = extracted.refPriceMax;
  } catch (e) {
    result.error =
      e instanceof Error ? `OCR: ${e.message}` : "OCR に失敗しました";
  }

  return result;
}

/** Recompute icon/main rects + crop records when the user picks a new preset. */
export function applyPresetRects(
  presetId: string,
  iconRect: CropRect,
  mainRect: CropRect | undefined,
  source: { width: number; height: number },
): Partial<BulkEntry> {
  const now = Date.now();
  const patch: Partial<BulkEntry> = {
    presetId,
    iconRect,
    mainRect,
    iconCrop: {
      rect: iconRect,
      source: { width: source.width, height: source.height },
      croppedAt: now,
    },
    mainCrop: mainRect
      ? {
          rect: mainRect,
          source: { width: source.width, height: source.height },
          croppedAt: now,
        }
      : undefined,
  };
  return patch;
}

/** Render an icon thumbnail data URL for the bulk list row. */
export async function renderIconThumb(
  source: Blob,
  rect: CropRect,
): Promise<string> {
  const blob = await cropAndEncode(source, rect, {
    maxWidth: THUMB_MAX_W,
    quality: 0.8,
  });
  return blobToDataUrl(blob);
}
