"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BulkEntry } from "./types";

interface BulkDraftValue {
  entries: BulkEntry[];
  setEntries: (
    next: BulkEntry[] | ((prev: BulkEntry[]) => BulkEntry[]),
  ) => void;
  updateEntry: (id: string, patch: Partial<BulkEntry>) => void;
  patchEntry: (
    id: string,
    fn: (prev: BulkEntry) => Partial<BulkEntry>,
  ) => void;
  removeEntry: (id: string) => void;
  clear: () => void;
  /** Look up the source image Blob for a row (in-memory only). */
  getSourceBlob: (id: string) => Blob | undefined;
  setSourceBlob: (id: string, blob: Blob) => void;
  hasSource: (id: string) => boolean;
}

const Ctx = createContext<BulkDraftValue | null>(null);

/**
 * Provides the bulk-register draft to /register/bulk and /register?bulkIndex=…
 * — both routes share this provider via app/register/layout.tsx, so navigation
 * between them keeps the entries (and their source Blobs) alive.
 *
 * Source Blobs are kept in a Ref so dropping them in/out doesn't trigger
 * re-renders. Refresh wipes everything (in-memory only) — that's the
 * deliberate trade-off; the user signed off on it.
 */
export function BulkDraftProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const blobsRef = useRef<Map<string, Blob>>(new Map());

  const updateEntry = useCallback(
    (id: string, patch: Partial<BulkEntry>) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      );
    },
    [],
  );

  const patchEntry = useCallback(
    (id: string, fn: (prev: BulkEntry) => Partial<BulkEntry>) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...fn(e) } : e)),
      );
    },
    [],
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    blobsRef.current.delete(id);
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    blobsRef.current.clear();
  }, []);

  const getSourceBlob = useCallback(
    (id: string) => blobsRef.current.get(id),
    [],
  );
  const setSourceBlob = useCallback((id: string, blob: Blob) => {
    blobsRef.current.set(id, blob);
  }, []);
  const hasSource = useCallback(
    (id: string) => blobsRef.current.has(id),
    [],
  );

  const value = useMemo<BulkDraftValue>(
    () => ({
      entries,
      setEntries,
      updateEntry,
      patchEntry,
      removeEntry,
      clear,
      getSourceBlob,
      setSourceBlob,
      hasSource,
    }),
    [
      entries,
      updateEntry,
      patchEntry,
      removeEntry,
      clear,
      getSourceBlob,
      setSourceBlob,
      hasSource,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBulkDraft(): BulkDraftValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useBulkDraft must be used inside <BulkDraftProvider>");
  }
  return v;
}

/** Convenience: read a single entry by index, or undefined. */
export function useBulkEntryAt(index: number): BulkEntry | undefined {
  const { entries } = useBulkDraft();
  return entries[index];
}
