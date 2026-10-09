const PLACEHOLDER_ORIGIN = 'https://redirect-check.invalid'

/**
 * The same-origin path (with query and hash) a `?redirect=` value points at,
 * or undefined for anything that could leave the site. `startsWith('/')` is
 * not enough: `//evil.com` and `/\evil.com` are protocol-relative URLs.
 */
export function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/')) return undefined

  let url: URL
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN)
  } catch {
    return undefined
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return undefined

  // An encoded double slash is a plain path today, but is one decode away
  // from a protocol-relative URL for anything that decodes before it navigates.
  let decoded: string
  try {
    decoded = decodeURIComponent(url.pathname)
  } catch {
    return undefined
  }
  if (decoded.startsWith('//') || decoded.includes('\\')) return undefined

  return `${url.pathname}${url.search}${url.hash}`
}
