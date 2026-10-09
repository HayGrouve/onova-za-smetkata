import { describe, expect, it } from 'vitest'
import { looksLikeConvexId } from './convex-id.ts'

describe('looksLikeConvexId', () => {
  it('accepts ids as Convex prints them', () => {
    // A bill id from a dev deployment, and the 31-character id in Convex's docs.
    expect(looksLikeConvexId('j57a0tzsgd3ndd7n0f22tcwbyn8fz8p0')).toBe(true)
    expect(looksLikeConvexId('3k7ty84apk2zy00ay4st1n5p9kh7tf8')).toBe(true)
  })

  it('rejects what a mangled link leaves behind', () => {
    expect(looksLikeConvexId('notarealid')).toBe(false)
    expect(looksLikeConvexId('')).toBe(false)
    expect(looksLikeConvexId('J57A0TZSGD3NDD7N0F22TCWBYN8FZ8P0')).toBe(false)
    expect(looksLikeConvexId('j57a0tzsgd3ndd7n0f22tcwbyn8fz8p0%20')).toBe(false)
    // Crockford base32 has no i, l, o or u.
    expect(looksLikeConvexId('i57a0tzsgd3ndd7n0f22tcwbyn8fz8p0')).toBe(false)
  })
})
