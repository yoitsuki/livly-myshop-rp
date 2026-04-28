import Dexie, { type EntityTable } from "dexie";
import type { CropRect } from "./image";
import type { CropPreset } from "./preset";
import { SEED_PRESETS } from "./preset";
import type { ShopPhase } from "./shopPeriods";

export type TagType = "period" | "gacha" | "category" | "custom";

/** Crop rectangle in source-image pixel coordinates, plus the source dimensions. */
export interface ItemCropRecord {
  rect: CropRect;
  source: { width: number; height: number };
  /** Encoded epoch ms when the crop was made. */
  croppedAt: number;
}

/** Shop round metadata captured per item. */
export interface ShopPeriodRecord {
  /** YYYYMM in JST. */
  yearMonth: string;
  phase: ShopPhase;
  /** Whether the value was auto-derived from the main image checkedAt. */
  auto: boolean;
}

export interface Item {
  id: string;
  /** Cropped icon — used in list rows and detail header. */
  iconBlob?: Blob;
  /** Cropped main image — shown large on the detail page. */
  mainImageBlob?: Blob;
  /** Crop coordinates that produced iconBlob (pixel coords on the source). */
  iconCrop?: ItemCropRecord;
  /** Crop coordinates that produced mainImageBlob. */
  mainCrop?: ItemCropRecord;
  /** Legacy v2 field; preserved on read for older records. */
  imageBlob?: Blob;
  /** Legacy v2 thumbnail; preserved for older records. */
  thumbBlob?: Blob;
  /** Reserved for a future Drive backup. Optional and unused for now. */
  driveFileId?: string;
  driveThumbnailUrl?: string;
  name: string;
  category: string;
  minPrice: number;
  refPriceMin: number;
  refPriceMax: number;
  tagIds: string[];
  /** Shop round + phase. Populated automatically from checkedAt when a main
   * image is present, or chosen by the user when not. */
  shopPeriod?: ShopPeriodRecord;
  /** Free-text price source when no main image exists (e.g. site name + URL). */
  priceSource?: string;
  /** EXIF DateTimeOriginal — epoch ms */
  checkedAt: number;
  /** Record creation — never overwritten */
  createdAt: number;
  /** Updated only on metadata edits */
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  type: TagType;
  color?: string;
  createdAt: number;
}

export interface AppSettings {
  id: "singleton";
  ocrProvider: "tesseract" | "claude";
  claudeApiKey?: string;
  claudeModel?: string;
  googleClientId?: string;
  driveFolderId?: string;
  /** Ordered list of crop presets — first match wins during detection. */
  cropPresets?: CropPreset[];
}

export class AppDB extends Dexie {
  items!: EntityTable<Item, "id">;
  tags!: EntityTable<Tag, "id">;
  settings!: EntityTable<AppSettings, "id">;

  constructor() {
    super("livly-myshop-rp");
    this.version(1).stores({
      items: "id, name, category, checkedAt, createdAt, updatedAt, *tagIds",
      tags: "id, name, type, createdAt",
      settings: "id",
    });
    // v2: imageBlob added (no index changes — same store keys are reused).
    this.version(2).stores({
      items: "id, name, category, checkedAt, createdAt, updatedAt, *tagIds",
      tags: "id, name, type, createdAt",
      settings: "id",
    });
  }
}

let _db: AppDB | undefined;

export function db(): AppDB {
  if (typeof window === "undefined") {
    throw new Error("db() must be called on the client");
  }
  if (!_db) _db = new AppDB();
  return _db;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function createItem(
  input: Omit<Item, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = Date.now();
  const id = uid();
  await db().items.add({
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export type ItemMetaPatch = Partial<
  Pick<
    Item,
    | "name"
    | "category"
    | "minPrice"
    | "refPriceMin"
    | "refPriceMax"
    | "tagIds"
    | "checkedAt"
    | "shopPeriod"
    | "priceSource"
  >
>;

/** Update metadata fields. Bumps updatedAt; never touches createdAt. */
export async function updateItemMeta(
  id: string,
  patch: ItemMetaPatch
): Promise<void> {
  await db().transaction("rw", db().items, async () => {
    const current = await db().items.get(id);
    if (!current) return;
    await db().items.put({ ...current, ...patch, updatedAt: Date.now() });
  });
}

/** Remove the main image (and its crop record) from an item. */
export async function clearMainImage(id: string): Promise<void> {
  await db().transaction("rw", db().items, async () => {
    const current = await db().items.get(id);
    if (!current) return;
    const next: Item = { ...current };
    delete next.mainImageBlob;
    delete next.mainCrop;
    delete next.imageBlob;
    await db().items.put(next);
  });
}

/** Replace icon and/or main image without bumping updatedAt. */
export async function updateItemImage(
  id: string,
  patch: {
    iconBlob?: Blob;
    mainImageBlob?: Blob;
    iconCrop?: ItemCropRecord;
    mainCrop?: ItemCropRecord;
  }
): Promise<void> {
  // Use an explicit get + put inside a transaction so other Blob fields on
  // the record (iconBlob / mainImageBlob etc.) survive the round-trip. Some
  // browsers' IndexedDB implementations can lose sibling Blobs on a partial
  // update of a record that already contains Blobs.
  await db().transaction("rw", db().items, async () => {
    const current = await db().items.get(id);
    if (!current) return;
    await db().items.put({ ...current, ...patch });
  });
}

export async function deleteItem(id: string): Promise<void> {
  await db().items.delete(id);
}

export async function createTag(input: Omit<Tag, "id" | "createdAt">): Promise<string> {
  const id = uid();
  await db().tags.add({ ...input, id, createdAt: Date.now() });
  return id;
}

export async function deleteTag(id: string): Promise<void> {
  await db().tags.delete(id);
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db().settings.get("singleton");
  if (existing) {
    if (!existing.cropPresets || existing.cropPresets.length === 0) {
      const next = { ...existing, cropPresets: SEED_PRESETS };
      await db().settings.put(next);
      return next;
    }
    return existing;
  }
  const initial: AppSettings = {
    id: "singleton",
    ocrProvider: "tesseract",
    claudeModel: "claude-sonnet-4-6",
    cropPresets: SEED_PRESETS,
  };
  await db().settings.put(initial);
  return initial;
}

export async function patchSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = (await db().settings.get("singleton")) ?? {
    id: "singleton" as const,
    ocrProvider: "tesseract" as const,
    claudeModel: "claude-sonnet-4-6",
    cropPresets: SEED_PRESETS,
  };
  await db().settings.put({ ...current, ...patch, id: "singleton" });
}
