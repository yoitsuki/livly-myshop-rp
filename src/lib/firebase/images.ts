"use client";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { storage } from "./client";

export type ImageKind = "icon" | "main";

export interface UploadedImage {
  url: string;
  path: string;
}

const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** compressImage in src/lib/image.ts always emits JPEG. */
const CONTENT_TYPE = "image/jpeg";
const EXTENSION = "jpg";

function imagePath(itemId: string, kind: ImageKind): string {
  return `items/${itemId}/${kind}.${EXTENSION}`;
}

export async function uploadItemImage(
  itemId: string,
  kind: ImageKind,
  blob: Blob,
): Promise<UploadedImage> {
  const path = imagePath(itemId, kind);
  const fileRef = ref(storage(), path);
  await uploadBytes(fileRef, blob, {
    contentType: CONTENT_TYPE,
    cacheControl: CACHE_CONTROL,
  });
  const url = await getDownloadURL(fileRef);
  return { url, path };
}

/**
 * Best-effort. Missing files are common (e.g. an item that never had a main
 * image) and shouldn't propagate as errors — the caller is removing references
 * regardless.
 */
export async function deleteItemImage(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage(), path));
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: unknown }).code === "storage/object-not-found"
    ) {
      return;
    }
    throw e;
  }
}

/** Convenience for deleteItem: blow away both slots without inspecting the doc. */
export async function deleteAllItemImages(itemId: string): Promise<void> {
  await Promise.all([
    deleteItemImage(imagePath(itemId, "icon")),
    deleteItemImage(imagePath(itemId, "main")),
  ]);
}
