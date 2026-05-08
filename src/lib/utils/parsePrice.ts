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

/**
 * 参考価格の範囲を表示用 string にする ( v0.27.25 ) 。
 * - min と max の両方が > 0 で値が違う → "min–max"
 * - 片方だけ ( または min == max ) → 単一値で表示
 * - 両方 0 / NaN → "—"
 *
 * 入力時に「片方だけ」を許可するようになったので ( v0.27.25 で
 * bulkEntryMissingFields も両方 0 だけ NG に緩和 ) 、 表示側もそれに合わせて
 * 「0–4100」のような片側 0 表示を出さないようにする。
 */
export function formatPriceRange(min: number, max: number): string {
  const m = Number.isFinite(min) && min > 0 ? min : 0;
  const M = Number.isFinite(max) && max > 0 ? max : 0;
  if (m && M) {
    return m === M ? formatPrice(m) : `${formatPrice(m)}–${formatPrice(M)}`;
  }
  if (m) return formatPrice(m);
  if (M) return formatPrice(M);
  return "—";
}

/**
 * 入力された片側のみの参考価格を保存用に正規化する ( v0.27.25 ) 。 片方が
 * 0 ( = 未入力 ) のときはもう片方を mirror して両方に同値を入れる。 これに
 * より下流の dedup / 表示 / 並び替えが「両方が値を持つ」前提のままで動く。
 */
export function normalizePriceRange(
  min: number,
  max: number,
): { min: number; max: number } {
  const m = Number.isFinite(min) && min > 0 ? min : 0;
  const M = Number.isFinite(max) && max > 0 ? max : 0;
  return { min: m || M, max: M || m };
}
