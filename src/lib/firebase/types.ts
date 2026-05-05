import type { CropPreset } from "../preset";
import type { ShopPhase } from "../shopPeriods";
import type { CropRect } from "../image";

export type TagType = "gacha" | "bazaar" | "shop" | "other";

export interface ItemCropRecord {
  rect: CropRect;
  source: { width: number; height: number };
  croppedAt: number;
}

export interface ShopPeriodRecord {
  yearMonth: string;
  phase: ShopPhase;
  auto: boolean;
}

export interface PriceEntry {
  id: string;
  shopPeriod?: ShopPeriodRecord;
  refPriceMin: number;
  refPriceMax: number;
  checkedAt: number;
  priceSource?: string;
  createdAt: number;
}

export interface Item {
  id: string;
  iconUrl?: string;
  iconStoragePath?: string;
  mainImageUrl?: string;
  mainImageStoragePath?: string;
  iconCrop?: ItemCropRecord;
  mainCrop?: ItemCropRecord;
  name: string;
  category: string;
  tagIds: string[];
  minPrice: number;
  priceEntries: PriceEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  type: TagType;
  color?: string;
  createdAt: number;
}

export interface AppSettings {
  id: "singleton";
  cropPresets?: CropPreset[];
}
