import { describe, expect, it } from 'vitest'
import {
  parseBillMetadataPatch,
  parseTipInputToCents,
  validateBillMetadataField,
} from './bill-metadata-schema'
import { RESTAURANT_NAME_MAX } from './validation/constants'

describe('parseTipInputToCents', () => {
  it('returns 0 for empty tip', () => {
    expect(parseTipInputToCents('')).toEqual({ ok: true, cents: 0 })
    expect(parseTipInputToCents('0,00')).toEqual({ ok: true, cents: 0 })
  })

  it('parses valid tip', () => {
    expect(parseTipInputToCents('12,50')).toEqual({ ok: true, cents: 1250 })
  })

  it('rejects invalid tip', () => {
    expect(parseTipInputToCents('abc').ok).toBe(false)
  })
})

describe('parseBillMetadataPatch', () => {
  it('trims restaurant name', () => {
    const result = parseBillMetadataPatch({ restaurantName: '  Механа  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.restaurantName).toBe('Механа')
    }
  })

  it('allows empty restaurant while draft', () => {
    expect(parseBillMetadataPatch({ restaurantName: '' }).success).toBe(true)
  })

  it('rejects restaurant over max', () => {
    expect(
      parseBillMetadataPatch({
        restaurantName: 'x'.repeat(RESTAURANT_NAME_MAX + 1),
      }).success,
    ).toBe(false)
  })

  it('normalizes blank note to undefined', () => {
    const result = parseBillMetadataPatch({ note: '   ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.note).toBeUndefined()
    }
  })

  it('validates only provided keys', () => {
    expect(parseBillMetadataPatch({ tipCents: -1 }).success).toBe(false)
    expect(parseBillMetadataPatch({ date: Date.UTC(1999, 0, 1) }).success).toBe(
      false,
    )
  })
})

describe('validateBillMetadataField', () => {
  it('validates tip input for client save gate', () => {
    expect(validateBillMetadataField('tip', 'abc').ok).toBe(false)
    expect(validateBillMetadataField('tip', '3,00')).toEqual({
      ok: true,
      patch: { tipCents: 300 },
    })
  })
})
