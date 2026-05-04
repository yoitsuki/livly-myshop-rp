"use client";

import { firebaseAuth } from "@/lib/firebase/client";
import type { ExtractedFields } from "./parse";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

async function adminBearer(): Promise<string> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("OCR を呼ぶ前にログインが必要です");
  const token = await user.getIdToken();
  return `Bearer ${token}`;
}

export async function recognizeWithClaude(
  blob: Blob,
  apiKey: string,
  model?: string
): Promise<ExtractedFields> {
  const imageDataUrl = await blobToDataUrl(blob);
  const res = await fetch("/api/claude-ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: await adminBearer(),
    },
    body: JSON.stringify({ apiKey, model, imageDataUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Claude OCR failed (${res.status})`);
  }
  const json = (await res.json()) as Partial<ExtractedFields>;
  return {
    name: json.name ?? undefined,
    category: json.category ?? undefined,
    description: json.description ?? undefined,
    minPrice: typeof json.minPrice === "number" ? json.minPrice : undefined,
    refPriceMin:
      typeof json.refPriceMin === "number" ? json.refPriceMin : undefined,
    refPriceMax:
      typeof json.refPriceMax === "number" ? json.refPriceMax : undefined,
  };
}
