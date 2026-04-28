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

/** Shop round metadata captured per price entry. */
export interface ShopPeriodRecord {
  /** YYYYMM in JST. */
  yearMonth: string;
  phase: ShopPhase;
  /** Whether the value was auto-derived from the source screenshot's EXIF. */
  auto: boolean;
}

/**
 * One observation of an item's reference price (参考価格) during a single
 * shop round. Items accumulate these over time — see Item.priceEntries.
 * Note: 最低販売価格 (minPrice) lives on Item, not here, since it does
 * not vary across rounds.
 */
export interface PriceEntry {
  id: string;
  shopPeriod?: ShopPeriodRecord;
  refPriceMin: number;
  refPriceMax: number;
  /** Epoch ms — typically the source screenshot's EXIF DateTimeOriginal,
   * or a manual timestamp when the user logged a price without an image. */
  checkedAt: number;
  /** Free-text price source for entries logged without a main image
   * (e.g. "なんおし", "その他"). Per-entry, not item-level. */
  priceSource?: string;
  createdAt: number;
}

export interface Item {
  id: string;
  /** Cropped icon — used in list rows and detail header. */
  iconBlob?: Blob;
  /** Cropped main image — shown large on the detail page. */
  mainImageBlob?: Blob;
  /** Crop coordinates that produced iconBlob. */
  iconCrop?: ItemCropRecord;
  /** Crop coordinates that produced mainImageBlob. */
  mainCrop?: ItemCropRecord;
  /** Reserved for a future Drive backup. Optional and unused for now. */
  driveFileId?: string;
  driveThumbnailUrl?: string;
  name: string;
  category: string;
  tagIds: string[];
  /** 最低販売価格 — invariant across shop rounds, captured at registration. */
  minPrice: number;
  /** All recorded reference-price observations. The latest (sorted by
   * shopPeriod) is shown on list rows and the detail header; the full
   * list is on the detail page. Always at least one entry for a saved item. */
  priceEntries: PriceEntry[];
  /** Record creation — never overwritten. */
  createdAt: number;
  /** Bumped on any meta or price-entry change. */
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
    this.version(2).stores({
      items: "id, name, category, checkedAt, createdAt, updatedAt, *tagIds",
      tags: "id, name, type, createdAt",
      settings: "id",
    });
    // v3: schema overhaul. Item now stores a priceEntries array instead of
    // single-price fields, and the legacy v2 imageBlob/thumbBlob fall away.
    // Pre-launch migration is a wipe — there is no production data to
    // preserve, and the field shapes are incompatible.
    this.version(3)
      .stores({
        items: "id, name, category, createdAt, updatedAt, *tagIds",
        tags: "id, name, type, createdAt",
        settings: "id",
      })
      .upgrade(async (tx) => {
        await tx.table("items").clear();
      });
    // v4: minPrice moves from PriceEntry to Item (it doesn't vary by
    // shop round). Pre-launch — wipe existing items rather than migrate.
    this.version(4)
      .stores({
        items: "id, name, category, createdAt, updatedAt, *tagIds",
        tags: "id, name, type, createdAt",
        settings: "id",
      })
      .upgrade(async (tx) => {
        await tx.table("items").clear();
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

// ---- Price entry helpers ---------------------------------------------------

/**
 * Newest-first ordering: shop round descending by yearMonth, then "lastDay"
 * before "ongoing" within the same round, and finally checkedAt for entries
 * without a shop period.
 */
function comparePriceEntriesDesc(a: PriceEntry, b: PriceEntry): number {
  const ay = a.shopPeriod?.yearMonth ?? "";
  const by = b.shopPeriod?.yearMonth ?? "";
  if (ay !== by) return ay > by ? -1 : 1;
  const ap = a.shopPeriod?.phase === "lastDay" ? 1 : 0;
  const bp = b.shopPeriod?.phase === "lastDay" ? 1 : 0;
  if (ap !== bp) return bp - ap;
  return b.checkedAt - a.checkedAt;
}

export function sortedPriceEntries(
  item: Pick<Item, "priceEntries">
): PriceEntry[] {
  return [...(item.priceEntries ?? [])].sort(comparePriceEntriesDesc);
}

export function latestPriceEntry(
  item: Pick<Item, "priceEntries">
): PriceEntry | undefined {
  if (!item.priceEntries || item.priceEntries.length === 0) return undefined;
  return sortedPriceEntries(item)[0];
}

export type PriceEntryInput = Omit<PriceEntry, "id" | "createdAt">;

export async function addPriceEntry(
  itemId: string,
  entry: PriceEntryInput
): Promise<string> {
  const id = uid();
  const now = Date.now();
  const newEntry: PriceEntry = { ...entry, id, createdAt: now };
  await db().transaction("rw", db().items, async () => {
    const current = await db().items.get(itemId);
    if (!current) throw new Error("アイテムが見つかりませんでした");
    await db().items.put({
      ...current,
      priceEntries: [...current.priceEntries, newEntry],
      updatedAt: now,
    });
  });
  return id;
}

export async function updatePriceEntry(
  itemId: string,
  entryId: string,
  patch: Partial<PriceEntryInput>
): Promise<void> {
  await db().transaction("rw", db().items, async () => {
    const current = await db().items.get(itemId);
    if (!current) throw new Error("アイテムが見つかりませんでした");
    const next: Item = {
      ...current,
      priceEntries: current.priceEntries.map((e) =>
        e.id === entryId ? { ...e, ...patch } : e
      ),
      updatedAt: Date.now(),
    };
    await db().items.put(next);
  });
}

export async function deletePriceEntry(
  itemId: string,
  entryId: string
): Promise<void> {
  await db().transaction("rw", db().items, async () => {
    const current = await db().items.get(itemId);
    if (!current) throw new Error("アイテムが見つかりませんでした");
    if (current.priceEntries.length <= 1) {
      throw new Error("最後の価格は削除できません");
    }
    const next: Item = {
      ...current,
      priceEntries: current.priceEntries.filter((e) => e.id !== entryId),
      updatedAt: Date.now(),
    };
    await db().items.put(next);
  });
}
