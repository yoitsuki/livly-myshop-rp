"use client";

import {
  deleteObject,
  getBlob,
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

/** Download an inbox object as a Blob (for OCR + crop). */
export async function fetchInboxBlob(path: string): Promise<Blob> {
  return await getBlob(ref(storage(), path));
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

