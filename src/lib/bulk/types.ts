import type { CropRect } from "@/lib/image";
import type { Item, ItemCropRecord, ShopPeriodRecord } from "@/lib/firebase/types";

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
  /** 時間不明 ( v0.27.17 ) — true なら checkedAt は当日 00:00 のダミー
   *  時刻を持っているだけで、 表示時に時刻 portion を伏せる。 */
  checkedAtTimeUnknown?: boolean;
  shopPeriod?: ShopPeriodRecord;

  /** Whether the row is selected for the bulk-save sweep. */
  checked: boolean;

  /**
   * 原本でなく レプリカ ( 同名アイテムの色違いなど ) として登録するかどうか。
   * undefined = 原本扱い、true = レプリカ。entryId モードの編集画面で
   * トグルでき、saveBulkEntry が createItem に転送する。
   */
  isReplica?: boolean;

  // ---- Inbox-only fields ----
  // These are set by /register/inbox on rows that originate from the public
  // viewer upload (Storage `inbox/`).  Bulk-sourced rows leave them undefined.
  /** Storage path so × can remove the source object after a confirm. */
  inboxStoragePath?: string;
  /** Filled once saveBulkEntry succeeds.  Inbox rows are NOT removed on
   *  save — they get a 登録済み badge and are locked from re-registering. */
  savedAt?: number;
}

/**
 * Required fields for createItem(). Used for row-level validation.
 *
 * `allItems` を渡すと、 既存同名 ( + 同 isReplica ) アイテムへの追記
 * ( merge ) に倒れる行については、 mergeItemPriceEntry が参照しない
 * カテゴリ / 最低価格 / アイコンの未入力は missing 扱いしない
 * ( v0.27.4 ) 。 allItems を渡さない呼出は従来通り全 field 必須で
 * 判定する ( 後方互換 ) 。
 */
export function bulkEntryMissingFields(
  e: BulkEntry,
  allItems?: Item[],
): string[] {
  const missing: string[] = [];
  const trimmedName = e.name.trim();
  if (!trimmedName) missing.push("名前");
  const mergeTarget =
    trimmedName && allItems
      ? allItems.find(
          (i) =>
            i.name === trimmedName && !!i.isReplica === !!e.isReplica,
        )
      : undefined;
  if (!mergeTarget) {
    if (!e.category.trim()) missing.push("カテゴリ");
    if (!Number.isFinite(e.minPrice) || e.minPrice <= 0)
      missing.push("最低価格");
    if (!e.iconRect) missing.push("アイコン");
  }
  // v0.27.25 — 片方だけの入力でも OK とする ( min OR max のどちらかが
  // > 0 ならば valid ) 。 0 / NaN を「未入力」と扱い、 両方とも未入力の
  // ときだけ missing に追加する。
  const minOk = Number.isFinite(e.refPriceMin) && e.refPriceMin > 0;
  const maxOk = Number.isFinite(e.refPriceMax) && e.refPriceMax > 0;
  if (!minOk && !maxOk) missing.push("参考価格");
  return missing;
}
