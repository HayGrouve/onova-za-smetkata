import { describe, expect, it } from 'vitest'
import { assertBillOwnedBy } from './bill_ownership'
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
