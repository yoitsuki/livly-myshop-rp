"use client";

import type { Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | undefined;

async function getWorker(
  onProgress?: (p: number, status: string) => void
): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return await createWorker("jpn", undefined, {
        logger: (m) => {
          if (m.status && typeof m.progress === "number") {
            onProgress?.(m.progress, m.status);
          }
        },
      });
    })();
  }
  return workerPromise;
}

export async function recognizeJapanese(
  source: Blob | File,
  onProgress?: (p: number, status: string) => void
): Promise<string> {
  const w = await getWorker(onProgress);
  const result = await w.recognize(source);
  return result.data.text;
}
