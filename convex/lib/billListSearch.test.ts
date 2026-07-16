import { describe, expect, it } from 'vitest'
import {
  billMatchesHomeSearch,
  normalizeHomeBillSearch,
} from './billListSearch'

describe('normalizeHomeBillSearch', () => {
  it('trims and lowercases', () => {
    expect(normalizeHomeBillSearch('  MeZE  ')).toBe('meze')
  })

  it('treats whitespace-only as empty', () => {
    expect(normalizeHomeBillSearch('   ')).toBe('')
    expect(normalizeHomeBillSearch(undefined)).toBe('')
  })
})

describe('billMatchesHomeSearch', () => {
  const bill = {
    restaurantName: 'Meze Bar',
    listParticipantNames: ['Иван', 'Мария'],
  }

  it('matches all when normalized search is empty', () => {
    expect(billMatchesHomeSearch(bill, '')).toBe(true)
  })

  it('matches restaurant contains case-insensitively', () => {
    expect(billMatchesHomeSearch(bill, 'meze')).toBe(true)
  })

  it('matches participant name contains', () => {
    expect(billMatchesHomeSearch(bill, 'мар')).toBe(true)
  })

  it('rejects non-matches', () => {
    expect(billMatchesHomeSearch(bill, 'pizza')).toBe(false)
  })

  it('treats missing participant names as empty list', () => {
    expect(
      billMatchesHomeSearch(
        { restaurantName: 'X', listParticipantNames: undefined },
        'иван',
      ),
    ).toBe(false)
  })
})
