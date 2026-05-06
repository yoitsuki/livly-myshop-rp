"use client";

import {
  deleteObject,
  getBlob,
  getDownloadURL,
  getMetadata,
  listAll,
  ref,
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
}

const INBOX_PREFIX = "inbox";

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
