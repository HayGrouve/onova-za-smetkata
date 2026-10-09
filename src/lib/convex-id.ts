/**
 * Convex document ids are Crockford base32 (lowercase, no i/l/o/u) of a
 * table-number varint, 16 id bytes and a 2-byte checksum: 19–23 bytes, so
 * 31–37 characters. A shape check only — the server still has the last word —
 * but enough to answer a mangled share link without asking it.
 */
const CONVEX_ID_SHAPE = /^[0-9a-hjkmnp-tv-z]{31,37}$/

export function looksLikeConvexId(value: string): boolean {
  return CONVEX_ID_SHAPE.test(value)
}
