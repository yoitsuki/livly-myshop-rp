"use client";

import { ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

async function ensureUploadable(
  file: File,
): Promise<{ blob: Blob; ext: string; type: string }> {
  const t = file.type.toLowerCase();
  if (t === "image/jpeg" || t === "image/png" || t === "image/webp") {
    const ext = t === "image/jpeg" ? "jpg" : t === "image/png" ? "png" : "webp";
    return { blob: file, ext, type: t };
  }
  // HEIC など admin の OCR が読めない形式は canvas で JPEG に再エンコードする。
  // EXIF は失われるが、admin パイプを落とすよりはマシ。
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.9,
      ),
    );
    return { blob, ext: "jpg", type: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface InboxUploadResult {
  path: string;
}

export async function uploadToInbox(file: File): Promise<InboxUploadResult> {
  const { blob, ext, type } = await ensureUploadable(file);
  const id = crypto.randomUUID();
  const path = `inbox/${id}.${ext}`;
  await uploadBytes(ref(storage(), path), blob, {
    contentType: type,
    customMetadata: {
      originalLastModified: String(file.lastModified),
    },
  });
  return { path };
}
