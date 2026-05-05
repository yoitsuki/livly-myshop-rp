import type { TagType } from "@/lib/firebase/types";

export interface SeedTag {
  name: string;
  type: TagType;
}

/**
 * Reference event/period tags imported in bulk via the /tags page's
 * "シード読み込み" button. Idempotent: seedTagsIfMissing() skips entries
 * whose name already exists in Firestore.
 */
export const SEED_TAGS: SeedTag[] = [
  // gradely (11) — "グレショ:YYYY年M月"
  { name: "グレショ:2025年10月", type: "gradely" },
  { name: "グレショ:2025年5月", type: "gradely" },
  { name: "グレショ:2024年10月", type: "gradely" },
  { name: "グレショ:2024年9月", type: "gradely" },
  { name: "グレショ:2024年6月", type: "gradely" },
  { name: "グレショ:2024年1月", type: "gradely" },
  { name: "グレショ:2023年11月", type: "gradely" },
  { name: "グレショ:2023年10月", type: "gradely" },
  { name: "グレショ:2023年8月", type: "gradely" },
  { name: "グレショ:2023年7月", type: "gradely" },
  { name: "グレショ:2023年6月", type: "gradely" },

  // bazaar (12)
  { name: "幻想のブロッサムパレス", type: "bazaar" },
  { name: "Luminous Prism Island", type: "bazaar" },
  { name: "聖なる炎と不死の錬金術", type: "bazaar" },
  { name: "月夜にきらめく金桜の島", type: "bazaar" },
  { name: "冬の本の島", type: "bazaar" },
  { name: "深き水底の神秘", type: "bazaar" },
  { name: "秘密の薔薇の園", type: "bazaar" },
  { name: "聖なる森のクリスマス", type: "bazaar" },
  { name: "七惑星の錬金室", type: "bazaar" },
  { name: "桜舞う花あかりの島", type: "bazaar" },
  { name: "冬の深い森", type: "bazaar" },
  { name: "祝福の太陽と神秘の月", type: "bazaar" },

  // nuts (3)
  { name: "シンデレラとガラスの靴の物語", type: "nuts" },
  { name: "迷いの森とお菓子の物語", type: "nuts" },
  { name: "毒林檎と鏡の物語", type: "nuts" },

  // collab (3)
  { name: "にじさんじショップ", type: "collab" },
  { name: "Mrs. GREEN APPLEショップ", type: "collab" },
  { name: "サンリオキャラクターズショップ", type: "collab" },

  // creators (29)
  { name: "第1回リヴクリ_ぬえちゃんショップ", type: "creators" },
  { name: "第1回リヴクリ_FDショップ", type: "creators" },
  { name: "第1回リヴクリ_くらげショップ", type: "creators" },
  { name: "第1回リヴクリ_mocoショップ", type: "creators" },
  { name: "第1回リヴクリ_アキラショップ", type: "creators" },
  { name: "第2回リヴクリ_VGショップ", type: "creators" },
  { name: "第2回リヴクリ_ジャムショップ", type: "creators" },
  { name: "第2回リヴクリ_バラリーショップ", type: "creators" },
  { name: "第2回リヴクリ_LiveLifeFactoryショップ", type: "creators" },
  { name: "第3回リヴクリ_caruuuumyショップ", type: "creators" },
  { name: "第3回リヴクリ_フア・ポヨショップ", type: "creators" },
  { name: "第3回リヴクリ_FDショップ", type: "creators" },
  { name: "第3回リヴクリ_エレナショップ", type: "creators" },
  { name: "第3回リヴクリ_MoMiショップ", type: "creators" },
  { name: "第4回リヴクリ_Jajaショップ", type: "creators" },
  { name: "第4回リヴクリ_けいショップ", type: "creators" },
  { name: "第4回リヴクリ_いな子ショップ", type: "creators" },
  { name: "第4回リヴクリ_ナカムラアヤナショップ", type: "creators" },
  { name: "第4回リヴクリ_LIV RECORDSショップ", type: "creators" },
  { name: "第5回リヴクリ_mocoショップ", type: "creators" },
  { name: "第5回リヴクリ_梱包 tbaショップ", type: "creators" },
  { name: "第5回リヴクリ_シトロンショップ", type: "creators" },
  { name: "第5回リヴクリ_INARIショップ", type: "creators" },
  { name: "第5回リヴクリ_メディチショップ", type: "creators" },
  { name: "第6回リヴクリ_KUMAOショップ", type: "creators" },
  { name: "第6回リヴクリ_モーレイショップ", type: "creators" },
  { name: "第6回リヴクリ_Live Life Factoryショップ", type: "creators" },
  { name: "第6回リヴクリ_VANGUARD GRAPHICSショップ", type: "creators" },
  { name: "第6回リヴクリ_LIV RECORDSショップ", type: "creators" },
];
