"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { firestore } from "./client";
import {
  itemFromFs,
  settingsFromFs,
  tagFromFs,
} from "./mappers";
import type { AppSettings, Item, Tag } from "./types";

/**
 * Returns `undefined` while the first snapshot is loading — matches the
 * useLiveQuery semantics that the existing pages branch on.
 */

export function useItems(): Item[] | undefined {
  const [data, setData] = useState<Item[]>();
  useEffect(() => {
    const q = query(
      collection(firestore(), "items"),
      orderBy("updatedAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setData(snap.docs.map((d) => itemFromFs(d.id, d.data())));
    });
  }, []);
  return data;
}

/** `null` once we know the doc doesn't exist; `undefined` while loading. */
export function useItem(id: string | null | undefined): Item | null | undefined {
  const [data, setData] = useState<Item | null>();
  useEffect(() => {
    setData(undefined);
    if (!id) {
      setData(null);
      return;
    }
    return onSnapshot(doc(firestore(), "items", id), (snap) => {
      setData(snap.exists() ? itemFromFs(snap.id, snap.data()) : null);
    });
  }, [id]);
  return data;
}

export function useTags(): Tag[] | undefined {
  const [data, setData] = useState<Tag[]>();
  useEffect(() => {
    const q = query(
      collection(firestore(), "tags"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(q, (snap) => {
      setData(snap.docs.map((d) => tagFromFs(d.id, d.data())));
    });
  }, []);
  return data;
}

export function useSettings(): AppSettings | undefined {
  const [data, setData] = useState<AppSettings>();
  useEffect(() => {
    return onSnapshot(doc(firestore(), "settings", "singleton"), (snap) => {
      if (snap.exists()) {
        setData(settingsFromFs(snap.data()));
      } else {
        setData({
          id: "singleton",
          ocrProvider: "tesseract",
          claudeModel: "claude-sonnet-4-6",
        });
      }
    });
  }, []);
  return data;
}
