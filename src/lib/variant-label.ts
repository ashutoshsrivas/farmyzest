// Variant label normalisation.
//
// Vasy variant labels are inconsistent: a colour can sit in the size field
// ("BLACK"), size + colour can be packed together with varying separators
// ("M-44 / BLACK", "100 /BLACK", "L/40"), and colour codes ("CL1") appear in
// both fields. This module is the single source of truth for splitting a raw
// label into {size, color} and for resolving a colour name to a swatch hex.
//
// The enrichment script (scripts/vasy-enrich-variants.mjs) keeps an identical
// copy of classifyVariantLabel so the DB and the storefront agree — keep the
// two in sync if you touch the rules.

// Known colour names (single words). Multi-word colours ("SKY BLUE") and
// misspellings ("BEOWN") are handled by the fall-through rules below.
const COLOR_WORDS = new Set([
  "BLACK", "WHITE", "BLUE", "RED", "GREEN", "YELLOW", "PINK", "GREY", "GRAY",
  "BROWN", "BEIGE", "CREAM", "CHERRY", "MAROON", "NAVY", "OLIVE", "ORANGE",
  "PURPLE", "GOLD", "SILVER", "TAN", "CAMEL", "KHAKI", "MUSTARD", "RUST",
  "TEAL", "WINE", "PEACH", "LAVENDER", "MINT", "CORAL", "IVORY", "SKY",
  "DENIM", "CHARCOAL", "RANI", "FIROZI", "MEHENDI", "GAJRI", "SEA", "BOTTLE",
  "ROYAL", "DARK", "LIGHT", "MULTI", "MULTICOLOR", "MULTICOLOUR", "ONION",
  "LEMON", "WASHED", "DIRTY", "DUSTY", "CLEAN",
]);

const SIZE_WORDS = new Set([
  "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL", "2XL", "3XL", "4XL",
  "5XL", "6XL", "FREE", "FREESIZE", "FREE SIZE", "ONESIZE", "ONE SIZE",
  "STD", "STANDARD", "NA", "N/A",
]);

const isColorCode = (u: string) => /^CL\s?\d+$/.test(u);

function isColorToken(token: string): boolean {
  const u = token.toUpperCase().trim();
  if (!u) return false;
  if (COLOR_WORDS.has(u)) return true;
  if (isColorCode(u)) return true;
  const words = u.split(/\s+/);
  // multi-word, all alphabetic, containing a known colour word → colour
  if (words.length > 1 && words.some((w) => COLOR_WORDS.has(w)) && words.every((w) => /^[A-Z-]+$/.test(w))) {
    return true;
  }
  return false;
}

function isSizeToken(token: string): boolean {
  const u = token.toUpperCase().replace(/\s+/g, " ").trim();
  if (SIZE_WORDS.has(u)) return true;
  if (isColorCode(u)) return false;
  if (/\d/.test(u)) return true; // numeric / waisted sizes (40, L-40, 2XL-44/W-36)
  if (/^[2-6]?X*[SLM]L?$/.test(u)) return true; // S, M, L, XL, XXL, 2XL …
  return false;
}

/**
 * Split a raw Vasy variant label into a clean size + colour. Either may be
 * null. Unknown alphabetic tokens (e.g. misspelled colours) default to colour.
 */
export function classifyVariantLabel(raw: string | null | undefined): { size: string | null; color: string | null } {
  let s = String(raw ?? "").trim();
  if (!s) return { size: null, color: null };
  s = s.replace(/\s*\/\s*/g, "/"); // normalise "a / b", "a /b" → "a/b"
  const parts = s.split("/").map((p) => p.trim()).filter(Boolean);
  const sizes: string[] = [];
  const colors: string[] = [];
  for (const p of parts) {
    if (isColorCode(p.toUpperCase())) colors.push(p);
    else if (isColorToken(p)) colors.push(p);
    else if (isSizeToken(p)) sizes.push(p);
    else colors.push(p); // unknown alpha → colour name
  }
  return { size: sizes.join("/") || null, color: colors.join("/") || null };
}

/**
 * Safety net for the shop filter. Takes the distinct size + colour values
 * stored in the DB and re-buckets any stragglers (a colour sitting in size,
 * etc.), returning clean, de-duplicated, sorted lists.
 */
export function reclassifyFilterValues(
  rawSizes: (string | null)[],
  rawColors: (string | null)[],
): { sizes: string[]; colors: string[] } {
  const sizeSet = new Set<string>();
  const colorSet = new Set<string>();
  const absorb = (val: string | null) => {
    const { size, color } = classifyVariantLabel(val);
    if (size) sizeSet.add(size);
    if (color) colorSet.add(color);
  };
  rawSizes.forEach(absorb);
  rawColors.forEach(absorb);
  return {
    sizes: [...sizeSet].sort(sizeSort),
    colors: [...colorSet].sort((a, b) => a.localeCompare(b)),
  };
}

// Sort sizes naturally: XS<S<M<L<XL…, then numeric, then the rest.
const SIZE_RANK = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL", "5XL", "6XL"];
function sizeSort(a: string, b: string): number {
  const ra = SIZE_RANK.indexOf(a.toUpperCase());
  const rb = SIZE_RANK.indexOf(b.toUpperCase());
  if (ra !== -1 && rb !== -1) return ra - rb;
  if (ra !== -1) return -1;
  if (rb !== -1) return 1;
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b);
}

// Canonical base size for the shop filter. Collapses a chest-suffixed label to
// its apparel size ("M-40" → "M", "XL-44" → "XL", "L/42" → "L"), keeps a pure
// numeric size as-is ("41" → "41"), and returns null for a non-size (e.g. a
// colour mistakenly stored in the size column, like "BLACK"). This is what
// makes "select M" match M, M-40, M-42, M-44… instead of only the bare "M".
const BASE_SIZE_SET = new Set(SIZE_RANK);
export function baseSize(raw: string | null | undefined): string | null {
  const { size } = classifyVariantLabel(raw);
  if (!size) return null;
  const first = size.split(/[/\-\s]+/)[0]?.trim().toUpperCase();
  if (!first) return null;
  if (BASE_SIZE_SET.has(first)) return first; // letter size
  if (/^\d+$/.test(first)) return first; // numeric (shoe / waist) size
  if (/^[2-6]X+L$/.test(first)) return first; // 2XL, 3XL…
  return first; // fallback — whatever the leading token is
}

/** Distinct, naturally-sorted canonical base sizes from raw DB size values. */
export function baseSizesFromRaw(rawSizes: (string | null)[]): string[] {
  const set = new Set<string>();
  for (const r of rawSizes) {
    const b = baseSize(r);
    if (b) set.add(b);
  }
  return [...set].sort(sizeSort);
}

// Colour-name → swatch hex. Resolution: exact match, then any known colour
// word inside a multi-word/compound name, then a neutral chip.
const COLOR_HEX: Record<string, string> = {
  BLACK: "#1a1a1a", WHITE: "#f5f5f5", WHITR: "#f5f5f5", OFFWHITE: "#f0ece1", IVORY: "#f0ece1", CREAM: "#f3ead3",
  BLUE: "#2f5fd0", "NAVY": "#1c2b4a", "NAVY BLUE": "#1c2b4a", "ROYAL BLUE": "#2c44a6", "SKY": "#7ec8e3", "SKY BLUE": "#7ec8e3",
  "DARK BLUE": "#1c2b4a", "DENIM": "#3b5a7a", "DENIM BLUE": "#3b5a7a",
  RED: "#c0392b", CHERRY: "#a4133c", MAROON: "#6b1f2a", MEHROON: "#6b1f2a", WINE: "#5e2233",
  GREEN: "#2e7d4f", OLIVE: "#6b6b23", "BOTTLE GREEN": "#0b3d2e", "DARK GREEN": "#14452f", MINT: "#9fe2bf", TEAL: "#1f7a7a",
  YELLOW: "#e6c200", LEMON: "#e6e600", MUSTARD: "#cda434", GOLD: "#c9a227",
  PINK: "#e75480", PEACH: "#ffb59e", CORAL: "#ff6f61", LAVENDER: "#b497bd", PURPLE: "#6b3fa0",
  GREY: "#8a8a8a", GRAY: "#8a8a8a", CHARCOAL: "#36454f", SILVER: "#c0c0c0",
  BROWN: "#6b4226", BEOWN: "#6b4226", BEIGE: "#d8cab0", TAN: "#c19a6b", CAMEL: "#b08d57", KHAKI: "#9b8b5e", KHAKHI: "#9b8b5e", RUST: "#a8431f",
  ORANGE: "#e07a2c", ONION: "#c98a96",
};
const COLOR_FALLBACK = "#bdbdbd";

export function colorHex(name: string): string {
  const u = name.toUpperCase().trim();
  if (COLOR_HEX[u]) return COLOR_HEX[u];
  if (/^CL\s?\d+$/.test(u)) return COLOR_FALLBACK; // unnamed colour code
  // compound name → first recognised colour word
  for (const w of u.split(/[\s/-]+/)) if (COLOR_HEX[w]) return COLOR_HEX[w];
  return COLOR_FALLBACK;
}
