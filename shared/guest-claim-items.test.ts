import { describe, expect, it } from 'vitest'
import { filterGuestClaimItemsBySearch } from './guest-claim-items'

describe('filterGuestClaimItemsBySearch', () => {
  it('filters items by name', () => {
    const items = [{ name: 'Салата' }, { name: 'Бира' }]

    expect(filterGuestClaimItemsBySearch(items, 'би')).toEqual([
      { name: 'Бира' },
    ])
    expect(filterGuestClaimItemsBySearch(items, '')).toEqual(items)
  })

  it('ignores case and surrounding spaces', () => {
    const items = [{ name: 'Шопска салата' }]
    expect(filterGuestClaimItemsBySearch(items, '  ШОПСКА ')).toEqual(items)
  })
})
