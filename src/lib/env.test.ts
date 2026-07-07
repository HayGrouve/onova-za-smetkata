import { describe, expect, it } from 'vitest'
import { getConvexUrl, validateConvexUrlForBuild } from './env'

describe('getConvexUrl', () => {
  it('returns trimmed url when set', () => {
    expect(getConvexUrl('https://example.convex.cloud')).toBe(
      'https://example.convex.cloud',
    )
  })

  it('returns undefined for empty values', () => {
    expect(getConvexUrl(undefined)).toBeUndefined()
    expect(getConvexUrl('  ')).toBeUndefined()
  })
})

describe('validateConvexUrlForBuild', () => {
  it('throws in production when url missing', () => {
    expect(() =>
      validateConvexUrlForBuild({
        prod: true,
        convexUrl: undefined,
      }),
    ).toThrow('VITE_CONVEX_URL')
  })

  it('does not throw in development when url missing', () => {
    expect(() =>
      validateConvexUrlForBuild({
        prod: false,
        convexUrl: undefined,
      }),
    ).not.toThrow()
  })

  it('does not throw in production when url present', () => {
    expect(() =>
      validateConvexUrlForBuild({
        prod: true,
        convexUrl: 'https://example.convex.cloud',
      }),
    ).not.toThrow()
  })
})
