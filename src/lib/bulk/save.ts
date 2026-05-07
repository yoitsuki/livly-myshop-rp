import {
  createItem,
  isNewestYearMonth,
  mergeItemPriceEntry,
  uid,
  type Item,
  type PriceEntry,
} from "@/lib/firebase/repo";
import { cropAndEncode } from "@/lib/image";
import type { BulkEntry } from "./types";

export interface SaveBulkEntryArgs {
  entry: BulkEntry;
  source: Blob;
  /** Snapshot of all items, used to detect same-name duplicates for merge. */
  allItems: Item[];
}

export interface SaveBulkEntryResult {
  itemId: string;
  /** True when the entry merged into an existing same-name item. */
  merged: boolean;
}

/**
 * Persist one bulk row. Crop the icon (and main if present) from the source
 * Blob, then either createItem() or — if a same-name item already exists —
 * mergeItemPriceEntry(). For the merge path the main image is replaced only
 * when this entry's yearMonth is at least as recent as everything else on
 * the existing item (matches the behavior in /register/bulk before this
 * function was extracted).
 *
 * Throws on validation / IO failure; the caller is expected to surface the
 * error and decide whether to keep the row.
 */
export async function saveBulkEntry({
  entry,
  source,
  allItems,
}: SaveBulkEntryArgs): Promise<SaveBulkEntryResult> {
  if (!entry.iconRect) throw new Error("アイコンの矩形が未設定です");

  const iconBlob = await cropAndEncode(source, entry.iconRect, {
    maxWidth: 320,
    quality: 0.85,
  });
  const mainBlob = entry.mainRect
    ? await cropAndEncode(source, entry.mainRect, {
        maxWidth: 1200,
        quality: 0.85,
      })
    : undefined;

  const trimmedName = entry.name.trim();
  const existingItem = allItems.find((i) => i.name === trimmedName);

  if (existingItem) {
    const newYearMonth = entry.shopPeriod?.yearMonth;
    const replaceMain =
      !!mainBlob && isNewestYearMonth(existingItem, newYearMonth);
    await mergeItemPriceEntry({
      itemId: existingItem.id,
      newEntry: {
        shopPeriod: entry.shopPeriod,
        refPriceMin: entry.refPriceMin,
        refPriceMax: entry.refPriceMax || entry.refPriceMin,
        checkedAt: entry.checkedAt,
        priceSource:
          !mainBlob && entry.priceSource ? entry.priceSource : undefined,
      },
      replaceMainImage:
        replaceMain && mainBlob
          ? { blob: mainBlob, crop: entry.mainCrop }
          : undefined,
    });
    return { itemId: existingItem.id, merged: true };
  }

  const initialEntry: PriceEntry = {
    id: uid(),
    shopPeriod: entry.shopPeriod,
    refPriceMin: entry.refPriceMin,
    refPriceMax: entry.refPriceMax || entry.refPriceMin,
    checkedAt: entry.checkedAt,
    priceSource:
      !mainBlob && entry.priceSource ? entry.priceSource : undefined,
    createdAt: Date.now(),
  };

  const itemId = await createItem({
    iconBlob,
    mainImageBlob: mainBlob,
    iconCrop: entry.iconCrop,
    mainCrop: entry.mainCrop,
    name: trimmedName,
    category: entry.category.trim(),
    tagIds: entry.tagIds,
    minPrice: entry.minPrice,
    priceEntries: [initialEntry],
    isReplica: entry.isReplica,
  });
  return { itemId, merged: false };
}
