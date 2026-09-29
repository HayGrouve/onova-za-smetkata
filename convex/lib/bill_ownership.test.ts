import { describe, expect, it } from 'vitest'
import { assertBillOwnedBy, isBillOwner } from './bill_ownership'
import type { Id } from '../_generated/dataModel'

describe('assertBillOwnedBy', () => {
  it('passes when owner matches', () => {
    expect(() =>
      assertBillOwnedBy(
        { ownerId: 'user_1' as Id<'users'> },
        'user_1' as Id<'users'>,
      ),
    ).not.toThrow()
  })

  it('throws when owner differs', () => {
    expect(() =>
      assertBillOwnedBy(
        { ownerId: 'user_1' as Id<'users'> },
        'user_2' as Id<'users'>,
      ),
    ).toThrow()
  })
})

describe('isBillOwner', () => {
  const bill = { ownerId: 'user_1' as Id<'users'> }

  it('is true only for the owner', () => {
    expect(isBillOwner(bill, 'user_1' as Id<'users'>)).toBe(true)
    expect(isBillOwner(bill, 'user_2' as Id<'users'>)).toBe(false)
  })

  it('is false for a signed-out caller or a missing bill', () => {
    expect(isBillOwner(bill, null)).toBe(false)
    expect(isBillOwner(null, 'user_1' as Id<'users'>)).toBe(false)
  })
})
