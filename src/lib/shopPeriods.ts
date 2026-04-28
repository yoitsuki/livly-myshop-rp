/**
 * Shop round schedule. The display key is YYYYMM in JST. See docs/DATA_SOURCES.md
 * for credit.
 */

export interface ShopRound {
  roundNumber: number;
  /** YYYYMM in JST, used as a stable key. */
  yearMonth: string;
  /** epoch ms */
  start: number;
  /** epoch ms */
  end: number;
}

export type ShopPhase = "ongoing" | "lastDay";

const T = (iso: string) => new Date(iso).getTime();

/** Newest first. */
export const SHOP_ROUNDS: ShopRound[] = [
  {
    roundNumber: 10,
    yearMonth: "202602",
    start: T("2026-02-09T12:00:00+09:00"),
    end: T("2026-02-16T23:59:59+09:00"),
  },
  {
    roundNumber: 9,
    yearMonth: "202511",
    start: T("2025-11-03T12:00:00+09:00"),
    end: T("2025-11-12T23:59:59+09:00"),
  },
  {
    roundNumber: 8,
    yearMonth: "202508",
    start: T("2025-08-18T12:00:00+09:00"),
    end: T("2025-08-31T23:59:59+09:00"),
  },
  {
    roundNumber: 7,
    yearMonth: "202502",
    start: T("2025-02-12T12:00:00+09:00"),
    end: T("2025-02-19T23:59:59+09:00"),
  },
  {
    roundNumber: 6,
    yearMonth: "202411",
    start: T("2024-11-04T12:00:00+09:00"),
    end: T("2024-11-11T23:59:59+09:00"),
  },
  {
    roundNumber: 5,
    yearMonth: "202408",
    start: T("2024-08-16T12:00:00+09:00"),
    end: T("2024-08-31T23:59:59+09:00"),
  },
  {
    roundNumber: 4,
    yearMonth: "202403",
    start: T("2024-03-08T12:00:00+09:00"),
    end: T("2024-03-15T11:59:59+09:00"),
  },
  {
    roundNumber: 3,
    yearMonth: "202311",
    start: T("2023-11-20T12:00:00+09:00"),
    end: T("2023-11-27T11:59:59+09:00"),
  },
  {
    roundNumber: 2,
    yearMonth: "202308",
    start: T("2023-08-25T12:00:00+09:00"),
    end: T("2023-09-01T11:59:59+09:00"),
  },
  {
    roundNumber: 1,
    yearMonth: "202302",
    start: T("2023-02-20T12:00:00+09:00"),
    end: T("2023-02-27T11:59:59+09:00"),
  },
];

/** Returns the JST YYYY-MM-DD string for an epoch ms value. */
function jstDateKey(ms: number): string {
  const jst = new Date(ms + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * Map an epoch ms (typically the EXIF / lastModified time) to a shop round
 * and its phase. Returns null if the timestamp falls outside any known round.
 */
export function resolveShopPeriod(
  ms: number
): { round: ShopRound; phase: ShopPhase } | null {
  for (const round of SHOP_ROUNDS) {
    if (ms >= round.start && ms <= round.end) {
      const phase: ShopPhase =
        jstDateKey(ms) === jstDateKey(round.end) ? "lastDay" : "ongoing";
      return { round, phase };
    }
  }
  return null;
}

/** "202602最終日" / "202602開催中" */
export function formatShopPeriod(yearMonth: string, phase: ShopPhase): string {
  return `${yearMonth}${phase === "lastDay" ? "最終日" : "開催中"}`;
}

/** Look up a round by its yearMonth key. */
export function findRound(yearMonth: string): ShopRound | undefined {
  return SHOP_ROUNDS.find((r) => r.yearMonth === yearMonth);
}

/**
 * Index of a round in `SHOP_ROUNDS` (which is sorted newest first).
 * Returns -1 for unknown values.
 */
export function roundAgeIndex(yearMonth: string): number {
  return SHOP_ROUNDS.findIndex((r) => r.yearMonth === yearMonth);
}
