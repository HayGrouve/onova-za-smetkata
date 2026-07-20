import { describe, expect, it } from 'vitest'
import {
  calculateItemsSubtotalCents,
  formatEurInputValue,
  resolveInitialTipCents,
  tipCentsFromPercent,
} from './tip-calculations'

describe('tipCentsFromPercent', () => {
  it('rounds to nearest cent', () => {
    expect(tipCentsFromPercent(1001, 10)).toBe(100)
    expect(tipCentsFromPercent(333, 15)).toBe(50)
  })

  it('returns 0 for zero subtotal', () => {
    expect(tipCentsFromPercent(0, 20)).toBe(0)
  })

  it('returns 0 for zero percent', () => {
    expect(tipCentsFromPercent(5000, 0)).toBe(0)
  })
})

describe('calculateItemsSubtotalCents', () => {
  it('sums line totals', () => {
    expect(
      calculateItemsSubtotalCents([
        { id: 'a', unitPriceCents: 500, quantity: 2 },
        { id: 'b', unitPriceCents: 300, quantity: 1 },
      ]),
    ).toBe(1300)
  })
})

describe('formatEurInputValue', () => {
  it('formats cents for Bulgarian input', () => {
    expect(formatEurInputValue(1250)).toBe('12,50')
    expect(formatEurInputValue(0)).toBe('')
  })
})

describe('resolveInitialTipCents', () => {
  it('computes from percent preference', () => {
    expect(resolveInitialTipCents({ mode: 'percent', percent: 15 }, 2000)).toBe(
      300,
    )
  })

  it('uses custom cents when stored', () => {
    expect(
      resolveInitialTipCents({ mode: 'custom', customCents: 400 }, 2000),
    ).toBe(400)
  })

  it('returns 0 when no preference', () => {
    expect(resolveInitialTipCents(null, 2000)).toBe(0)
  })
})
