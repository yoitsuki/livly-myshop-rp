import type { CropPreset } from "../preset";
import type { ShopPhase } from "../shopPeriods";
import type { CropRect } from "../image";

export type TagType =
  | "gacha"
  | "bazaar"
  | "nuts"
  | "gradely"
  | "collab"
  | "creators"
  | "other";

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
  /** true = レプリカ。undefined / false = 原本 ( 既定 ) 。
   *  ゲーム内呼称は「原本」 ( 「本物」ではない ) — UI も全部「原本」表記。 */
  isReplica?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  type: TagType;
  color?: string;
  /** Optional ordering within /tags page; createdAt is the tiebreaker. */
  displayOrder?: number;
  createdAt: number;
}

export interface AppSettings {
  id: "singleton";
  cropPresets?: CropPreset[];
}
