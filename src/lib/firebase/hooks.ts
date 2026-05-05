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
import { TYPE_ORDER } from "@/lib/tagTypes";

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
      const tags = snap.docs.map((d) => tagFromFs(d.id, d.data()));
      // Stable sort: TYPE_ORDER → displayOrder asc (undefined goes last) →
      // createdAt asc as a tiebreaker.
      tags.sort((a, b) => {
        const ta = TYPE_ORDER.indexOf(a.type);
        const tb = TYPE_ORDER.indexOf(b.type);
        if (ta !== tb) return ta - tb;
        const oa = a.displayOrder ?? Number.POSITIVE_INFINITY;
        const ob = b.displayOrder ?? Number.POSITIVE_INFINITY;
        if (oa !== ob) return oa - ob;
        return a.createdAt - b.createdAt;
      });
      setData(tags);
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
        setData({ id: "singleton" });
      }
    });
  }, []);
  return data;
}
