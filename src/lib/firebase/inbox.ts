"use client";

import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  listAll,
  ref,
  updateMetadata,
} from "firebase/storage";
import { storage } from "./client";

export interface InboxFile {
  /** Storage path, e.g. "inbox/abc123.jpg". Uniquely identifies the file. */
  path: string;
  /** File name only (last path segment). Acts as the row id in the UI. */
  name: string;
  /** Public download URL (cached on the bucket). */
  url: string;
  /** Server-side upload time as epoch ms. */
  uploadedAt: number;
  /** Stored size in bytes. */
  size: number;
  contentType?: string;
  /**
   * Custom metadata as written by the viewer (originalLastModified) and admin
   * (cachedOcr). Returned alongside the file so the inbox page can read the
   * cache without an extra round-trip per row.
   */
  customMetadata?: Record<string, string>;
}

const INBOX_PREFIX = "inbox";
const OCR_CACHE_KEY = "cachedOcr";
const SAVED_AT_KEY = "savedAt";

/** Shape of the JSON we serialise into customMetadata.cachedOcr. */
export interface InboxOcrCache {
  name?: string;
  category?: string;
  minPrice?: number;
  refPriceMin?: number;
  refPriceMax?: number;
  cachedAt: number;
}

/** List every object under `inbox/`, newest-first. */
export async function listInboxFiles(): Promise<InboxFile[]> {
  const folderRef = ref(storage(), INBOX_PREFIX);
  const result = await listAll(folderRef);

  const files = await Promise.all(
    result.items.map(async (item) => {
      const [meta, url] = await Promise.all([
        getMetadata(item),
        getDownloadURL(item),
      ]);
      const uploadedAt = meta.timeCreated
        ? new Date(meta.timeCreated).getTime()
        : Date.now();
      return {
        path: item.fullPath,
        name: item.name,
        url,
        uploadedAt,
        size: meta.size,
        contentType: meta.contentType,
        customMetadata: meta.customMetadata ?? undefined,
      } satisfies InboxFile;
    }),
  );

  files.sort((a, b) => b.uploadedAt - a.uploadedAt);
  return files;
}

/**
 * Download an inbox object as a Blob via fetch on its public download URL.
 *
 * We deliberately don't use Storage SDK's getBlob() here — on iOS Safari it
 * has been observed to hang silently in cross-origin contexts (Vercel
 * preview / production domains), with no error and no resolution.  fetch
 * surfaces CORS / network problems as a TypeError, and an AbortController
 * gives us a hard upper bound so a single bad row can't freeze the loop.
 */
export async function fetchInboxBlob(file: InboxFile): Promise<Blob> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(file.url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`画像のダウンロード失敗 (${res.status})`);
    }
    return await res.blob();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("画像ダウンロードがタイムアウトしました (45 秒)");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Delete an inbox object. Admin-only per storage.rules. */
export async function deleteInboxFile(path: string): Promise<void> {
  await deleteObject(ref(storage(), path));
}

/** Read the OCR cache that we previously wrote into customMetadata. */
export function readOcrCache(file: InboxFile): InboxOcrCache | null {
  const raw = file.customMetadata?.[OCR_CACHE_KEY];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InboxOcrCache;
  } catch {
    return null;
  }
}

/**
 * Persist OCR results onto the inbox object so subsequent loads can skip the
 * Claude API call. updateMetadata MERGES customMetadata, so unrelated keys
 * (e.g. originalLastModified from the viewer) are preserved.
 */
export async function writeOcrCache(
  path: string,
  value: InboxOcrCache,
): Promise<void> {
  await updateMetadata(ref(storage(), path), {
    customMetadata: { [OCR_CACHE_KEY]: JSON.stringify(value) },
  });
}

/** Read the persisted "登録済み" timestamp from customMetadata. */
export function readInboxSavedAt(file: InboxFile): number | undefined {
  const raw = file.customMetadata?.[SAVED_AT_KEY];
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Mark an inbox object as 登録済み by writing the timestamp into
 * customMetadata. Like writeOcrCache, the merge-semantics of updateMetadata
 * keep unrelated keys ( cachedOcr / originalLastModified ) intact.
 */
export async function writeInboxSavedAt(
  path: string,
  ts: number,
): Promise<void> {
  await updateMetadata(ref(storage(), path), {
    customMetadata: { [SAVED_AT_KEY]: String(ts) },
  });
}

