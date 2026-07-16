import { describe, expect, it } from 'vitest'
import {
  HOME_BILL_PAGE_SIZE,
  HOME_BILL_SEARCH_DEBOUNCE_MS,
  homeBillListEmptyMessage,
  homeBillStatusSearchParam,
  parseHomeBillStatusSearch,
} from './home-bill-list.ts'

describe('home bill list constants', () => {
  it('locks page size and debounce from the spec/plan', () => {
    expect(HOME_BILL_PAGE_SIZE).toBe(20)
    expect(HOME_BILL_SEARCH_DEBOUNCE_MS).toBe(300)
  })
})

describe('parseHomeBillStatusSearch', () => {
  it('accepts draft and final', () => {
    expect(parseHomeBillStatusSearch('draft')).toBe('draft')
    expect(parseHomeBillStatusSearch('final')).toBe('final')
  })

  it('treats missing/invalid as all (undefined)', () => {
    expect(parseHomeBillStatusSearch(undefined)).toBeUndefined()
    expect(parseHomeBillStatusSearch('')).toBeUndefined()
    expect(parseHomeBillStatusSearch('all')).toBeUndefined()
    expect(parseHomeBillStatusSearch(1)).toBeUndefined()
  })
})

describe('homeBillStatusSearchParam', () => {
  it('sets status undefined for all (URL omit)', () => {
    expect(homeBillStatusSearchParam(undefined)).toEqual({ status: undefined })
  })

  it('includes status for chips', () => {
    expect(homeBillStatusSearchParam('draft')).toEqual({ status: 'draft' })
  })
})

describe('homeBillListEmptyMessage', () => {
  it('no bills at all', () => {
    expect(homeBillListEmptyMessage({ status: undefined, search: '' })).toBe(
      'Все още нямате сметки. Създайте първата си сметка!',
    )
  })

  it('search miss wins over status', () => {
    expect(homeBillListEmptyMessage({ status: 'draft', search: 'xyz' })).toBe(
      'Няма намерени сметки.',
    )
  })

  it('status-only empties', () => {
    expect(homeBillListEmptyMessage({ status: 'draft', search: '  ' })).toBe(
      'Няма чернови.',
    )
    expect(homeBillListEmptyMessage({ status: 'final', search: '' })).toBe(
      'Няма приключени.',
    )
  })
})
