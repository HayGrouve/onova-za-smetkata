import { describe, expect, it } from 'vitest'
import {
  HOME_BILL_PAGE_SIZE,
  HOME_BILL_SEARCH_DEBOUNCE_MS,
  homeBillListEmptyMessage,
} from './home-bill-list.ts'

describe('home bill list constants', () => {
  it('locks page size and debounce from the spec/plan', () => {
    expect(HOME_BILL_PAGE_SIZE).toBe(20)
    expect(HOME_BILL_SEARCH_DEBOUNCE_MS).toBe(300)
  })
})

describe('homeBillListEmptyMessage', () => {
  it('no bills at all', () => {
    expect(homeBillListEmptyMessage({ search: '' })).toBe(
      'Все още нямате сметки.',
    )
  })

  it('search miss', () => {
    expect(homeBillListEmptyMessage({ search: 'xyz' })).toBe(
      'Няма намерени сметки.',
    )
  })

  it('whitespace-only search counts as no search', () => {
    expect(homeBillListEmptyMessage({ search: '  ' })).toBe(
      'Все още нямате сметки.',
    )
  })
})
