"use client";

import { useEffect, useState } from "react";

/**
 * Per-device settings that don't belong on the server. The Claude API key
 * stays on the device the user typed it into; the OCR provider toggle and
 * model selection follow it because they only matter together.
 *
 * cropPresets are intentionally NOT here — those benefit from cross-device
 * sync and live on the Firestore settings doc.
 */
export type InboxPageSize = 5 | 10 | 20;

export interface LocalSettings {
  ocrProvider: "tesseract" | "claude";
  claudeApiKey?: string;
  claudeModel?: string;
  /** /register/inbox の 1 ページあたり件数。OCR / image download は表示中の
   *  ページ分のみ走る ( 大量画像で初期読み込みが詰まらないように ) 。 */
  inboxPageSize?: InboxPageSize;
}

const STORAGE_KEY = "livly-myshop-rp:local-settings";

const DEFAULTS: LocalSettings = {
  ocrProvider: "tesseract",
  claudeModel: "claude-sonnet-4-6",
  inboxPageSize: 10,
};

function read(): LocalSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function write(value: LocalSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getLocalSettings(): LocalSettings {
  return read();
}

export function patchLocalSettings(
  patch: Partial<LocalSettings>,
): LocalSettings {
  const next = { ...read(), ...patch };
  write(next);
  // Notify same-tab listeners; the storage event only fires across tabs.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("livly-myshop-rp:local-settings"));
  }
  return next;
}

export function useLocalSettings(): {
  settings: LocalSettings;
  patch: (p: Partial<LocalSettings>) => void;
} {
  const [settings, setSettings] = useState<LocalSettings>(DEFAULTS);

  useEffect(() => {
    setSettings(read());
    const onChange = () => setSettings(read());
    window.addEventListener("storage", onChange);
    window.addEventListener("livly-myshop-rp:local-settings", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("livly-myshop-rp:local-settings", onChange);
    };
  }, []);

  return {
    settings,
    patch: (p) => setSettings(patchLocalSettings(p)),
  };
}
