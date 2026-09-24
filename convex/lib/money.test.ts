import { describe, expect, it } from 'vitest'
import {
  assertNonNegativeIntCents,
  assertPositiveIntCents,
  assertPositiveQuantity,
} from '../../convex/lib/money'

describe('money validators', () => {
  it('accepts valid cents and quantities', () => {
    expect(assertNonNegativeIntCents(0)).toBe(0)
    expect(assertPositiveIntCents(100)).toBe(100)
    expect(assertPositiveQuantity(1)).toBe(1)
  })

  it('rejects fractional or negative money', () => {
    expect(() => assertNonNegativeIntCents(-1)).toThrow()
    expect(() => assertNonNegativeIntCents(1.5)).toThrow()
    expect(() => assertPositiveIntCents(0)).toThrow()
  })

  it('rejects invalid quantities', () => {
    expect(() => assertPositiveQuantity(0)).toThrow()
    expect(() => assertPositiveQuantity(1.2)).toThrow()
  })
})
