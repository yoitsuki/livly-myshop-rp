import Dexie, { type EntityTable } from "dexie";

export type TagType = "period" | "gacha" | "category" | "custom";

export interface Item {
  id: string;
  /** Resized + JPEG-compressed image (default max 1600px wide). */
  imageBlob?: Blob;
  /** Small thumbnail (default 240px wide) for list views. */
  thumbBlob?: Blob;
  /** Reserved for a future Drive backup. Optional and unused for now. */
  driveFileId?: string;
  driveThumbnailUrl?: string;
  name: string;
  category: string;
  description: string;
  minPrice: number;
  refPriceMin: number;
  refPriceMax: number;
  tagIds: string[];
  /** EXIF DateTimeOriginal — epoch ms */
  checkedAt: number;
  /** Record creation — never overwritten */
  createdAt: number;
  /** Updated only on metadata edits */
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
  ocrProvider: "tesseract" | "claude";
  claudeApiKey?: string;
  claudeModel?: string;
  googleClientId?: string;
  driveFolderId?: string;
}

export class AppDB extends Dexie {
  items!: EntityTable<Item, "id">;
  tags!: EntityTable<Tag, "id">;
  settings!: EntityTable<AppSettings, "id">;

  constructor() {
    super("livly-myshop-rp");
    this.version(1).stores({
      items: "id, name, category, checkedAt, createdAt, updatedAt, *tagIds",
      tags: "id, name, type, createdAt",
      settings: "id",
    });
    // v2: imageBlob added (no index changes — same store keys are reused).
    this.version(2).stores({
      items: "id, name, category, checkedAt, createdAt, updatedAt, *tagIds",
      tags: "id, name, type, createdAt",
      settings: "id",
    });
  }
}

let _db: AppDB | undefined;

export function db(): AppDB {
  if (typeof window === "undefined") {
    throw new Error("db() must be called on the client");
  }
  if (!_db) _db = new AppDB();
  return _db;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function createItem(
  input: Omit<Item, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const now = Date.now();
  const id = uid();
  await db().items.add({
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export type ItemMetaPatch = Partial<
  Pick<
    Item,
    | "name"
    | "category"
    | "description"
    | "minPrice"
    | "refPriceMin"
    | "refPriceMax"
    | "tagIds"
    | "checkedAt"
  >
>;

/** Update metadata fields. Bumps updatedAt; never touches createdAt. */
export async function updateItemMeta(
  id: string,
  patch: ItemMetaPatch
): Promise<void> {
  await db().items.update(id, { ...patch, updatedAt: Date.now() });
}

/** Replace image without bumping updatedAt. */
export async function updateItemImage(
  id: string,
  patch: { imageBlob?: Blob; thumbBlob?: Blob }
): Promise<void> {
  await db().items.update(id, patch);
}

export async function deleteItem(id: string): Promise<void> {
  await db().items.delete(id);
}

export async function createTag(input: Omit<Tag, "id" | "createdAt">): Promise<string> {
  const id = uid();
  await db().tags.add({ ...input, id, createdAt: Date.now() });
  return id;
}

export async function deleteTag(id: string): Promise<void> {
  await db().tags.delete(id);
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db().settings.get("singleton");
  if (existing) return existing;
  const initial: AppSettings = {
    id: "singleton",
    ocrProvider: "tesseract",
    claudeModel: "claude-sonnet-4-6",
  };
  await db().settings.put(initial);
  return initial;
}

export async function patchSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = (await db().settings.get("singleton")) ?? {
    id: "singleton" as const,
    ocrProvider: "tesseract" as const,
    claudeModel: "claude-sonnet-4-6",
  };
  await db().settings.put({ ...current, ...patch, id: "singleton" });
}
