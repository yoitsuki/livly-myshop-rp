import type { DocumentData } from "firebase/firestore";
import type { AppSettings, Item, Tag } from "./types";
import { normalizeTagType } from "@/lib/tagTypes";

// Drop undefined values so Firestore doesn't reject the write — undefined isn't
// a valid Firestore value, but we use undefined liberally on the TS side.
function compact<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

export function itemToFs(item: Item): DocumentData {
  return compact({
    iconUrl: item.iconUrl,
    iconStoragePath: item.iconStoragePath,
    mainImageUrl: item.mainImageUrl,
    mainImageStoragePath: item.mainImageStoragePath,
    iconCrop: item.iconCrop,
    mainCrop: item.mainCrop,
    name: item.name,
    category: item.category,
    tagIds: item.tagIds,
    minPrice: item.minPrice,
    priceEntries: item.priceEntries.map((e) =>
      compact({
        id: e.id,
        shopPeriod: e.shopPeriod ? compact({ ...e.shopPeriod }) : undefined,
        refPriceMin: e.refPriceMin,
        refPriceMax: e.refPriceMax,
        checkedAt: e.checkedAt,
        priceSource: e.priceSource,
        createdAt: e.createdAt,
      }),
    ),
    // Only true gets persisted — original is the implicit default and we
    // keep the Firestore schema clean by not writing the field at all.
    isReplica: item.isReplica === true ? true : undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  });
}

export function itemFromFs(id: string, data: DocumentData): Item {
  return {
    id,
    iconUrl: data.iconUrl,
    iconStoragePath: data.iconStoragePath,
    mainImageUrl: data.mainImageUrl,
    mainImageStoragePath: data.mainImageStoragePath,
    iconCrop: data.iconCrop,
    mainCrop: data.mainCrop,
    name: data.name ?? "",
    category: data.category ?? "",
    tagIds: Array.isArray(data.tagIds) ? data.tagIds : [],
    minPrice: typeof data.minPrice === "number" ? data.minPrice : 0,
    priceEntries: Array.isArray(data.priceEntries) ? data.priceEntries : [],
    isReplica: data.isReplica === true ? true : undefined,
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

export function tagToFs(tag: Tag): DocumentData {
  return compact({
    name: tag.name,
    type: tag.type,
    color: tag.color,
    displayOrder: tag.displayOrder,
    createdAt: tag.createdAt,
  });
}

export function tagFromFs(id: string, data: DocumentData): Tag {
  return {
    id,
    name: data.name ?? "",
    type: normalizeTagType(data.type),
    color: data.color,
    displayOrder:
      typeof data.displayOrder === "number" ? data.displayOrder : undefined,
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
  };
}

export function settingsToFs(s: AppSettings): DocumentData {
  return compact({
    cropPresets: s.cropPresets?.map((p) =>
      compact({
        id: p.id,
        name: p.name,
        width: p.width,
        height: p.height,
        colorMode: p.colorMode,
        topLeftHex: p.topLeftHex,
        colorTolerance: p.colorTolerance,
        icon: p.icon,
        main: p.main,
      }),
    ),
  });
}

export function settingsFromFs(data: DocumentData): AppSettings {
  return {
    id: "singleton",
    cropPresets: data.cropPresets,
  };
}
