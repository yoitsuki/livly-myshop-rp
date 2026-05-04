"use client";

import {
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "./client";
import {
  itemFromFs,
  itemToFs,
  settingsFromFs,
  settingsToFs,
  tagToFs,
} from "./mappers";
import {
  deleteAllItemImages,
  deleteItemImage,
  uploadItemImage,
} from "./images";
import type {
  AppSettings,
  Item,
  ItemCropRecord,
  PriceEntry,
  ShopPeriodRecord,
  Tag,
  TagType,
} from "./types";
import { SEED_PRESETS } from "../preset";

export type {
  AppSettings,
  Item,
  ItemCropRecord,
  PriceEntry,
  ShopPeriodRecord,
  Tag,
  TagType,
};

// id factory; same as the old db.ts uid().
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---- Items -----------------------------------------------------------------

export interface CreateItemInput {
  iconBlob?: Blob;
  mainImageBlob?: Blob;
  iconCrop?: ItemCropRecord;
  mainCrop?: ItemCropRecord;
  name: string;
  category: string;
  tagIds: string[];
  minPrice: number;
  priceEntries: PriceEntry[];
}

export async function createItem(input: CreateItemInput): Promise<string> {
  const id = uid();
  const icon = input.iconBlob
    ? await uploadItemImage(id, "icon", input.iconBlob)
    : undefined;
  const main = input.mainImageBlob
    ? await uploadItemImage(id, "main", input.mainImageBlob)
    : undefined;
  const now = Date.now();
  const item: Item = {
    id,
    iconUrl: icon?.url,
    iconStoragePath: icon?.path,
    mainImageUrl: main?.url,
    mainImageStoragePath: main?.path,
    iconCrop: input.iconCrop,
    mainCrop: input.mainCrop,
    name: input.name,
    category: input.category,
    tagIds: input.tagIds,
    minPrice: input.minPrice,
    priceEntries: input.priceEntries,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(firestore(), "items", id), itemToFs(item));
  return id;
}

export interface UpdateItemPatch {
  name?: string;
  category?: string;
  tagIds?: string[];
  minPrice?: number;
  /** New blob to crop and upload as the icon. */
  iconBlob?: Blob;
  iconCrop?: ItemCropRecord;
  /** New blob to crop and upload as the main image. */
  mainImageBlob?: Blob;
  mainCrop?: ItemCropRecord;
  /** Removes the main image regardless of mainImageBlob. */
  clearMain?: boolean;
}

export async function updateItem(
  id: string,
  patch: UpdateItemPatch,
): Promise<void> {
  // Upload first so the doc only ever points at fully-written objects.
  const icon = patch.iconBlob
    ? await uploadItemImage(id, "icon", patch.iconBlob)
    : undefined;
  const main =
    !patch.clearMain && patch.mainImageBlob
      ? await uploadItemImage(id, "main", patch.mainImageBlob)
      : undefined;

  const ref = doc(firestore(), "items", id);
  await runTransaction(firestore(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("アイテムが見つかりませんでした");
    const current = itemFromFs(snap.id, snap.data());
    const next: Item = { ...current };

    if (icon) {
      next.iconUrl = icon.url;
      next.iconStoragePath = icon.path;
    }
    if (patch.iconCrop) next.iconCrop = patch.iconCrop;

    if (patch.clearMain) {
      next.mainImageUrl = undefined;
      next.mainImageStoragePath = undefined;
      next.mainCrop = undefined;
    } else if (main) {
      next.mainImageUrl = main.url;
      next.mainImageStoragePath = main.path;
    }
    if (!patch.clearMain && patch.mainCrop) next.mainCrop = patch.mainCrop;

    if (patch.name !== undefined) next.name = patch.name;
    if (patch.category !== undefined) next.category = patch.category;
    if (patch.tagIds !== undefined) next.tagIds = patch.tagIds;
    if (patch.minPrice !== undefined) next.minPrice = patch.minPrice;

    next.updatedAt = Date.now();
    tx.set(ref, itemToFs(next));
  });

  if (patch.clearMain) {
    await deleteItemImage(`items/${id}/main.jpg`);
  }
}

export async function deleteItem(id: string): Promise<void> {
  // Doc first so listeners refresh promptly; storage cleanup is best-effort.
  await deleteDoc(doc(firestore(), "items", id));
  await deleteAllItemImages(id);
}

// ---- Price entries (item-embedded array, mutated via runTransaction) -------

export type PriceEntryInput = Omit<PriceEntry, "id" | "createdAt">;

export async function addPriceEntry(
  itemId: string,
  entry: PriceEntryInput,
): Promise<string> {
  const id = uid();
  const ref = doc(firestore(), "items", itemId);
  await runTransaction(firestore(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("アイテムが見つかりませんでした");
    const current = itemFromFs(snap.id, snap.data());
    const now = Date.now();
    const newEntry: PriceEntry = { ...entry, id, createdAt: now };
    const next: Item = {
      ...current,
      priceEntries: [...current.priceEntries, newEntry],
      updatedAt: now,
    };
    tx.set(ref, itemToFs(next));
  });
  return id;
}

export async function updatePriceEntry(
  itemId: string,
  entryId: string,
  patch: Partial<PriceEntryInput>,
): Promise<void> {
  const ref = doc(firestore(), "items", itemId);
  await runTransaction(firestore(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("アイテムが見つかりませんでした");
    const current = itemFromFs(snap.id, snap.data());
    const next: Item = {
      ...current,
      priceEntries: current.priceEntries.map((e) =>
        e.id === entryId ? { ...e, ...patch } : e,
      ),
      updatedAt: Date.now(),
    };
    tx.set(ref, itemToFs(next));
  });
}

export async function deletePriceEntry(
  itemId: string,
  entryId: string,
): Promise<void> {
  const ref = doc(firestore(), "items", itemId);
  await runTransaction(firestore(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("アイテムが見つかりませんでした");
    const current = itemFromFs(snap.id, snap.data());
    if (current.priceEntries.length <= 1) {
      throw new Error("最後の価格は削除できません");
    }
    const next: Item = {
      ...current,
      priceEntries: current.priceEntries.filter((e) => e.id !== entryId),
      updatedAt: Date.now(),
    };
    tx.set(ref, itemToFs(next));
  });
}

// ---- Tags ------------------------------------------------------------------

export async function createTag(
  input: Omit<Tag, "id" | "createdAt">,
): Promise<string> {
  const id = uid();
  const tag: Tag = { ...input, id, createdAt: Date.now() };
  await setDoc(doc(firestore(), "tags", id), tagToFs(tag));
  return id;
}

export async function deleteTag(id: string): Promise<void> {
  await deleteDoc(doc(firestore(), "tags", id));
}

/**
 * Cascades the deletion: every item that referenced the tag has its tagIds
 * array rewritten. Done in a batch with the tag delete so listeners only see
 * a consistent state.
 */
export async function deleteTagWithCascade(
  tagId: string,
  affectedItemIds: string[],
): Promise<void> {
  const batch = writeBatch(firestore());
  for (const itemId of affectedItemIds) {
    const ref = doc(firestore(), "items", itemId);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    const current = itemFromFs(snap.id, snap.data());
    if (!current.tagIds.includes(tagId)) continue;
    batch.update(ref, {
      tagIds: current.tagIds.filter((x) => x !== tagId),
      updatedAt: Date.now(),
    });
  }
  batch.delete(doc(firestore(), "tags", tagId));
  await batch.commit();
}

// ---- Settings --------------------------------------------------------------

const DEFAULT_SETTINGS: AppSettings = {
  id: "singleton",
  ocrProvider: "tesseract",
  claudeModel: "claude-sonnet-4-6",
  cropPresets: SEED_PRESETS,
};

export async function getSettings(): Promise<AppSettings> {
  const ref = doc(firestore(), "settings", "singleton");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, settingsToFs(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  }
  const current = settingsFromFs(snap.data());
  if (!current.cropPresets || current.cropPresets.length === 0) {
    const next = { ...current, cropPresets: SEED_PRESETS };
    await setDoc(ref, settingsToFs(next));
    return next;
  }
  return current;
}

export async function patchSettings(
  patch: Partial<AppSettings>,
): Promise<void> {
  const ref = doc(firestore(), "settings", "singleton");
  const snap = await getDoc(ref);
  const current = snap.exists() ? settingsFromFs(snap.data()) : DEFAULT_SETTINGS;
  const next: AppSettings = { ...current, ...patch, id: "singleton" };
  await setDoc(ref, settingsToFs(next));
}

// ---- Pure helpers (carried over from db.ts) --------------------------------

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
  item: Pick<Item, "priceEntries">,
): PriceEntry[] {
  return [...(item.priceEntries ?? [])].sort(comparePriceEntriesDesc);
}

export function latestPriceEntry(
  item: Pick<Item, "priceEntries">,
): PriceEntry | undefined {
  if (!item.priceEntries || item.priceEntries.length === 0) return undefined;
  return sortedPriceEntries(item)[0];
}

