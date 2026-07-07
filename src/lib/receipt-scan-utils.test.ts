import { describe, expect, it } from 'vitest'
import {
  filterExtractedItems,
  detectTotalsMismatch,
  sumItemsCents,
} from './receipt-scan-utils'

describe('filterExtractedItems', () => {
  it('removes zero and negative prices', () => {
    const items = [
      { name: 'Soup', unitPriceCents: 500, quantity: 1, confidence: 'high' as const },
      { name: 'Total', unitPriceCents: 0, quantity: 1, confidence: 'high' as const },
      { name: 'Bad', unitPriceCents: -100, quantity: 1, confidence: 'high' as const },
    ]
    expect(filterExtractedItems(items)).toHaveLength(1)
  })
})

describe('detectTotalsMismatch', () => {
  it('returns true when difference exceeds 1 cent', () => {
    expect(detectTotalsMismatch(1000, 1050)).toBe(true)
  })
  it('returns false when within 1 cent', () => {
    expect(detectTotalsMismatch(1000, 1001)).toBe(false)
  })
})

describe('sumItemsCents', () => {
  it('sums unit price times quantity for each item', () => {
    const items = [
      { name: 'Soup', unitPriceCents: 500, quantity: 2, confidence: 'high' as const },
      { name: 'Bread', unitPriceCents: 300, quantity: 1, confidence: 'high' as const },
    ]
    expect(sumItemsCents(items)).toBe(1300)
  })
})
