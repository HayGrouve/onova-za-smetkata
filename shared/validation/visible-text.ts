// Kept apart from the zod schemas so the app shell can use it without zod.

/**
 * Characters that render as nothing: controls, format marks (zero-width,
 * direction, soft hyphen), separators and the blank fillers some keyboards
 * offer. A name made only of these looks empty on every phone.
 */
const INVISIBLE_PATTERN = /[\p{Cc}\p{Cf}\p{Z}\u115f\u1160\u3164\uffa0\u2800]/gu

export function hasVisibleText(value: string): boolean {
  return value.replace(INVISIBLE_PATTERN, '').length > 0
}
