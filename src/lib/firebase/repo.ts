"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
import { SEED_TAGS } from "../seedTags";
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
  /** true = レプリカ、undefined = 原本 ( 既定 )。 */
  isReplica?: boolean;
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
    isReplica: input.isReplica,
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
  /** 切り替え可能。true / false / undefined を受ける ( undefined = 触らない ) */
  isReplica?: boolean;
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
    if (patch.isReplica !== undefined) {
      // false は undefined に畳む ( = 原本 )。compact が落として schema 維持。
      next.isReplica = patch.isReplica === true ? true : undefined;
    }

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
  mainImage?: { blob: Blob; crop?: ItemCropRecord },
): Promise<string> {
  const id = uid();
  const ref = doc(firestore(), "items", itemId);

  // Pre-fetch to decide whether to replace the item-level main image. The
  // entry's blob is uploaded only when it wins ( newest period or item had
  // no image ) ; otherwise it's discarded ( per spec — we don't store a
  // per-entry image ). Single-user app, so reading-then-writing outside
  // a strict txn is acceptable.
  let uploadedMain: { url: string; path: string } | undefined;
  let willReplace = false;
  if (mainImage) {
    const preSnap = await getDoc(ref);
    if (!preSnap.exists()) throw new Error("アイテムが見つかりませんでした");
    const preItem = itemFromFs(preSnap.id, preSnap.data());
    willReplace = shouldReplaceMainImage(preItem, entry.shopPeriod?.yearMonth);
    if (willReplace) {
      uploadedMain = await uploadItemImage(itemId, "main", mainImage.blob);
    }
  }

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
    if (willReplace && uploadedMain) {
      next.mainImageUrl = uploadedMain.url;
      next.mainImageStoragePath = uploadedMain.path;
      if (mainImage?.crop) next.mainCrop = mainImage.crop;
    }
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

export interface MergePriceEntryInput {
  itemId: string;
  newEntry: Omit<PriceEntry, "id" | "createdAt">;
  /**
   * When set, replaces the item's main image with the supplied blob (and
   * mainCrop, if provided). The new image is uploaded outside the
   * transaction so the doc only ever points at fully-written objects.
   */
  replaceMainImage?: {
    blob: Blob;
    crop?: ItemCropRecord;
  };
}

/**
 * Adds a new price entry to an existing item. If the new entry's
 * shopPeriod.yearMonth matches an existing entry's yearMonth, that older
 * entry is dropped (the new one wins — "1 件扱い" per yearMonth).
 *
 * Optionally replaces the main image. The icon is never touched.
 */
export async function mergeItemPriceEntry(
  input: MergePriceEntryInput,
): Promise<void> {
  const main = input.replaceMainImage
    ? await uploadItemImage(
        input.itemId,
        "main",
        input.replaceMainImage.blob,
      )
    : undefined;

  const ref = doc(firestore(), "items", input.itemId);
  await runTransaction(firestore(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("アイテムが見つかりませんでした");
    const current = itemFromFs(snap.id, snap.data());
    const newYearMonth = input.newEntry.shopPeriod?.yearMonth;

    const filtered = newYearMonth
      ? current.priceEntries.filter(
          (e) => e.shopPeriod?.yearMonth !== newYearMonth,
        )
      : current.priceEntries;

    const now = Date.now();
    const newEntry: PriceEntry = {
      ...input.newEntry,
      id: uid(),
      createdAt: now,
    };

    const next: Item = {
      ...current,
      priceEntries: [...filtered, newEntry],
      updatedAt: now,
    };

    if (main) {
      next.mainImageUrl = main.url;
      next.mainImageStoragePath = main.path;
      if (input.replaceMainImage?.crop) {
        next.mainCrop = input.replaceMainImage.crop;
      }
    }

    tx.set(ref, itemToFs(next));
  });
}

/**
 * Whether `candidateYearMonth` is at least as recent as every other
 * yearMonth in the item's priceEntries (entries that share the candidate
 * yearMonth itself are excluded since the merge replaces them).
 *
 * Returns false if the candidate yearMonth is empty/undefined — in that
 * case there is no period to compare against, so by convention the new
 * entry is not "the newest".
 */
export function isNewestYearMonth(
  item: Pick<Item, "priceEntries">,
  candidateYearMonth: string | undefined,
): boolean {
  if (!candidateYearMonth) return false;
  const others = item.priceEntries
    .filter((e) => e.shopPeriod?.yearMonth !== candidateYearMonth)
    .map((e) => e.shopPeriod?.yearMonth)
    .filter((y): y is string => !!y);
  if (others.length === 0) return true;
  const max = others.reduce((a, b) => (a > b ? a : b));
  return candidateYearMonth >= max;
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
 * Persist a new displayOrder for a list of tags. Single writeBatch so all
 * the tags in the dragged group flip atomically (no transient out-of-order
 * frame in the snapshot listeners).
 */
export async function reorderTags(
  ordered: Array<{ id: string; displayOrder: number }>,
): Promise<void> {
  if (ordered.length === 0) return;
  const batch = writeBatch(firestore());
  for (const { id, displayOrder } of ordered) {
    batch.update(doc(firestore(), "tags", id), { displayOrder });
  }
  await batch.commit();
}

/**
 * Idempotent bulk seeder. Reads every existing tag name, then writes the
 * subset of SEED_TAGS whose name is not already present. 58 entries fit
 * comfortably in a single 500-op writeBatch.
 */
export async function seedTagsIfMissing(): Promise<{
  created: number;
  skipped: number;
}> {
  const snap = await getDocs(collection(firestore(), "tags"));
  const existing = new Set(
    snap.docs.map((d) => (d.data().name as string | undefined) ?? ""),
  );

  const toCreate = SEED_TAGS.filter((t) => !existing.has(t.name));
  if (toCreate.length === 0) {
    return { created: 0, skipped: SEED_TAGS.length };
  }

  const batch = writeBatch(firestore());
  const now = Date.now();
  for (const t of toCreate) {
    const id = uid();
    const tag: Tag = {
      id,
      name: t.name,
      type: t.type,
      displayOrder: SEED_TAGS.indexOf(t),
      createdAt: now,
    };
    batch.set(doc(firestore(), "tags", id), tagToFs(tag));
  }
  await batch.commit();

  return {
    created: toCreate.length,
    skipped: SEED_TAGS.length - toCreate.length,
  };
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

/** v0.26.0+ : 情報元はあくまで PriceEntry 単位の事実 ( 登録時に画像を伴ったか
 *  / なんおし / その他 ) で表示する。item.mainImageUrl は item-level の
 *  画像保管先でしかなく、最新エントリの 情報元 とは独立。
 *  - entry.priceSource が "マイショ" / "なんおし" / "その他" → そのまま
 *  - undefined (legacy 未マイグレーション) → "設定無し"
 *    /settings の「情報元を移行する」ボタンで一度埋めてもらう前提。 */
export function entryInfoSourceLabel(entry: PriceEntry): string {
  return entry.priceSource?.trim() || "設定無し";
}

export function infoSourceLabel(
  item: Pick<Item, "priceEntries">,
): string {
  const latest = latestPriceEntry(item);
  return latest ? entryInfoSourceLabel(latest) : "設定無し";
}

/** 価格エントリ作成時の priceSource 決定ヘルパ。
 *  - メイン画像あり → "マイショ" ( フォーム入力に依らず固定 )
 *  - メイン画像なし → form の選択値 ( なんおし / その他 ) 、空なら なんおし */
export function resolveEntryPriceSource(
  hasMainImage: boolean,
  fallback: string | undefined,
): string {
  if (hasMainImage) return "マイショ";
  const trimmed = fallback?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "なんおし";
}

/** item.mainImageUrl を新エントリの画像で更新すべきか。
 *  - item に画像が無い → true ( 期間に関わらず最初の 1 枚を採用 )
 *  - 画像あり + 新エントリ yearMonth >= 既存最新 → true ( 上書き )
 *  - 画像あり + 古い期間 → false ( 既存維持 ) */
export function shouldReplaceMainImage(
  item: Pick<Item, "mainImageUrl" | "priceEntries">,
  newCandidateYearMonth: string | undefined,
): boolean {
  if (!item.mainImageUrl) return true;
  return isNewestYearMonth(item, newCandidateYearMonth);
}


