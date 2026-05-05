import type { CropRect } from "@/lib/image";
import type { ItemCropRecord, ShopPeriodRecord } from "@/lib/firebase/types";

export type BulkEntryStatus = "processing" | "ready" | "failed";

/**
 * One row in the bulk-register draft. The source Blob is held separately
 * in BulkDraftProvider's in-memory map (keyed by id) — it doesn't belong
 * here so this stays serializable / cheap to spread.
 */
export interface BulkEntry {
  id: string;
  fileName: string;
  fileSize: number;

  status: BulkEntryStatus;
  /** OCR / preset matching error message; rendered as a row badge. */
  error?: string;

  /** Source image dimensions, captured once the source Blob is loaded. */
  sourceWidth?: number;
  sourceHeight?: number;

  /** Preset matched at import time (sticky — independent of presetId). */
  detectedPresetId?: string;
  /**
   * Preset currently selected for this row. Undefined = "未選択";
   * the row needs a preset (or manual crop) before it can be saved.
   */
  presetId?: string;
  iconRect?: CropRect;
  mainRect?: CropRect;
  iconCrop?: ItemCropRecord;
  mainCrop?: ItemCropRecord;

  /** Small data URL of the cropped icon, used by the list thumbnail. */
  iconThumbDataUrl?: string;

  // Form values — pre-filled from OCR + EXIF, editable from /register
  name: string;
  category: string;
  tagIds: string[];
  minPrice: number;
  refPriceMin: number;
  refPriceMax: number;
  priceSource?: string;
  checkedAt: number;
  shopPeriod?: ShopPeriodRecord;

  /** Whether the row is selected for the bulk-save sweep. */
  checked: boolean;
}

/** Required fields for createItem(). Used for row-level validation. */
export function bulkEntryMissingFields(e: BulkEntry): string[] {
  const missing: string[] = [];
  if (!e.name.trim()) missing.push("名前");
  if (!e.category.trim()) missing.push("カテゴリ");
  if (!Number.isFinite(e.minPrice) || e.minPrice <= 0) missing.push("最低価格");
  if (!Number.isFinite(e.refPriceMin) || e.refPriceMin <= 0)
    missing.push("参考価格");
  if (!e.iconRect) missing.push("アイコン");
  return missing;
}
