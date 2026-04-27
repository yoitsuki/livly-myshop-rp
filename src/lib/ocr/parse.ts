import { parsePrice } from "@/lib/utils/parsePrice";

export interface ExtractedFields {
  name?: string;
  category?: string;
  description?: string;
  minPrice?: number;
  refPriceMin?: number;
  refPriceMax?: number;
}

const RANGE_RE = /(\d[\d,]*)\s*[〜~ー―\-－]\s*(\d[\d,]*)\s*GP/i;
const SINGLE_RE = /(\d[\d,]*)\s*GP/i;

/**
 * Heuristic parser for the リヴリー出品画面 OCR text.
 * Expected ordering: name / category / description... / 最低販売価格 / 参考販売価格.
 */
export function parseShopText(raw: string): ExtractedFields {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const result: ExtractedFields = {};
  let priceLineStart = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/最低/.test(line)) {
      const m = line.match(SINGLE_RE);
      if (m) result.minPrice = parsePrice(m[1]);
      priceLineStart = Math.min(priceLineStart, i);
    } else if (/参考/.test(line)) {
      const r = line.match(RANGE_RE);
      if (r) {
        result.refPriceMin = parsePrice(r[1]);
        result.refPriceMax = parsePrice(r[2]);
      } else {
        const s = line.match(SINGLE_RE);
        if (s) {
          const v = parsePrice(s[1]);
          result.refPriceMin = v;
          result.refPriceMax = v;
        }
      }
      priceLineStart = Math.min(priceLineStart, i);
    }
  }

  const head = lines.slice(0, priceLineStart);
  if (head.length > 0) result.name = head[0];
  if (head.length > 1) result.category = head[1];
  if (head.length > 2) result.description = head.slice(2).join("\n");

  return result;
}
