import { describe, expect, it } from 'vitest'
import {
  parseItemPriceInput,
  validateItemAddArgs,
  validateItemAddForm,
  validateItemNameInput,
  validateItemPriceInput,
  validateItemQuantityInput,
  validateItemUpdatePatch,
} from './item-schema'
import { ITEM_NAME_MAX, PAYMENT_NOTE_MAX } from './validation/constants'

describe('parseItemPriceInput', () => {
  it('parses comma decimal', () => {
    expect(parseItemPriceInput('12,50')).toEqual({ ok: true, cents: 1250 })
    expect(parseItemPriceInput('3,99')).toEqual({ ok: true, cents: 399 })
  })

  it('allows zero', () => {
    expect(parseItemPriceInput('0,00')).toEqual({ ok: true, cents: 0 })
  })

  it('rejects empty and invalid', () => {
    expect(parseItemPriceInput('').ok).toBe(false)
    expect(parseItemPriceInput('abc').ok).toBe(false)
  })
})

describe('validateItemAddForm', () => {
  it('accepts valid add form', () => {
    const result = validateItemAddForm({
      name: '  Салата  ',
      priceInput: '12,50',
      quantityInput: '2',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({
        name: 'Салата',
        unitPriceCents: 1250,
        quantity: 2,
      })
    }
  })

  it('returns per-field errors', () => {
    const result = validateItemAddForm({
      name: '',
      priceInput: 'abc',
      quantityInput: '0',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors.name).toBeTruthy()
      expect(result.fieldErrors.price).toBeTruthy()
      expect(result.fieldErrors.quantity).toBeTruthy()
    }
  })

  it('rejects overlong note', () => {
    const result = validateItemAddForm({
      name: 'Хляб',
      priceInput: '1,00',
      quantityInput: '1',
      note: 'x'.repeat(PAYMENT_NOTE_MAX + 1),
    })
    expect(result.ok).toBe(false)
  })
})

describe('validateItemAddArgs', () => {
  it('defaults quantity to 1', () => {
    const result = validateItemAddArgs({
      name: 'Вода',
      unitPriceCents: 200,
    })
    expect(result).toEqual({
      ok: true,
      data: { name: 'Вода', unitPriceCents: 200, quantity: 1 },
    })
  })

  it('rejects negative cents', () => {
    expect(validateItemAddArgs({ name: 'Вода', unitPriceCents: -1 }).ok).toBe(
      false,
    )
  })
})

describe('validateItemUpdatePatch', () => {
  it('validates only provided keys', () => {
    expect(validateItemUpdatePatch({ name: '  Ново  ' }).ok).toBe(true)
    expect(validateItemUpdatePatch({ unitPriceCents: -5 }).ok).toBe(false)
  })

  it('parses quantity from string patch', () => {
    const result = validateItemUpdatePatch({ quantity: '3' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.quantity).toBe(3)
  })

  it('normalizes blank note to undefined', () => {
    const result = validateItemUpdatePatch({ note: '   ' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.note).toBeUndefined()
  })
})

describe('single-field validators', () => {
  it('validateItemNameInput', () => {
    expect(validateItemNameInput('')).toBeTruthy()
    expect(validateItemNameInput('x'.repeat(ITEM_NAME_MAX + 1))).toBeTruthy()
    expect(validateItemNameInput('Ок')).toBeUndefined()
  })

  it('validateItemPriceInput', () => {
    expect(validateItemPriceInput('abc')).toBeTruthy()
    expect(validateItemPriceInput('2,00')).toBeUndefined()
  })

  it('validateItemQuantityInput', () => {
    expect(validateItemQuantityInput('0')).toBeTruthy()
    expect(validateItemQuantityInput('1000')).toBeTruthy()
    expect(validateItemQuantityInput('2')).toBeUndefined()
  })
})
