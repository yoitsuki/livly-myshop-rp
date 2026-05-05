import type { TagType } from "@/lib/firebase/types";

/** Display label per tag type. */
export const TYPE_LABEL: Record<TagType, string> = {
  gacha: "通常ガチャ",
  bazaar: "バザール",
  nuts: "ナッツ",
  gradely: "グレデリーショップ",
  collab: "コラボショップ",
  creators: "リヴリークリエイターズウィーク",
  other: "その他",
};

/** Stable ordering for tag groups in /tags + flat chip rows. */
export const TYPE_ORDER: TagType[] = [
  "gacha",
  "bazaar",
  "nuts",
  "gradely",
  "collab",
  "creators",
  "other",
];

/**
 * Atelier-tinted tag palette — desaturated, warm, sits cleanly on the
 * cream/white surfaces. bg = chip background, fg = chip text.
 */
export const TYPE_COLORS: Record<TagType, { bg: string; fg: string }> = {
  gacha: { bg: "#d8dfe8", fg: "#2c3e5b" }, // dusty blue
  bazaar: { bg: "#ebdcb8", fg: "#56411a" }, // warm sand / amber
  nuts: { bg: "#e2d8e8", fg: "#4a2c5b" }, // warm dusty lavender
  gradely: { bg: "#d8e3d6", fg: "#2c4a32" }, // sage / eucalyptus
  collab: { bg: "#dde6c8", fg: "#3d4a1c" }, // muted olive
  creators: { bg: "#ecd6cf", fg: "#5d2d24" }, // dusty rose
  other: { bg: "#dfd6c8", fg: "#4a4339" }, // warm gray
};

/** Coerce arbitrary Firestore tag.type values to the current TagType union. */
export function normalizeTagType(raw: unknown): TagType {
  if (
    raw === "gacha" ||
    raw === "bazaar" ||
    raw === "nuts" ||
    raw === "gradely" ||
    raw === "collab" ||
    raw === "creators" ||
    raw === "other"
  ) {
    return raw;
  }
  return "other";
}
