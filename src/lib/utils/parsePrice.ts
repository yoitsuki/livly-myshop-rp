/** Parse "4,100GP" / "4100" / " 1,800 " → number. Returns NaN on failure. */
export function parsePrice(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return NaN;
  if (typeof input === "number") return input;
  const cleaned = input.replace(/[,，\s]/g, "").replace(/[^0-9.\-]/g, "");
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function formatPrice(value: number): string {
  return value.toLocaleString("ja-JP");
}
