import { describe, expect, it } from 'vitest'
import { shouldDeleteReplacedReceiptStorage } from '../../convex/lib/receiptStorage'

describe('shouldDeleteReplacedReceiptStorage', () => {
  it('returns true when receipt storage id changes', () => {
    expect(
      shouldDeleteReplacedReceiptStorage(
        'storage_old' as never,
        'storage_new' as never,
      ),
    ).toBe(true)
  })

  it('returns false when ids match or next id is omitted', () => {
    expect(
      shouldDeleteReplacedReceiptStorage(
        'storage_old' as never,
        'storage_old' as never,
      ),
    ).toBe(false)
    expect(
      shouldDeleteReplacedReceiptStorage('storage_old' as never, undefined),
    ).toBe(false)
    expect(shouldDeleteReplacedReceiptStorage(undefined, 'storage_new' as never)).toBe(
      false,
    )
  })
})
