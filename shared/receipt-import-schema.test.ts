import { describe, expect, it } from 'vitest'
import {
  validateReceiptImportItems,
  validateReceiptImportRow,
  validateReceiptImportSelection,
} from './receipt-import-schema'

const validRow = {
  name: 'Салата',
  priceInput: '12,50',
  quantityInput: '2',
}

describe('validateReceiptImportRow', () => {
  it('accepts valid row', () => {
    const result = validateReceiptImportRow(validRow)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({
        name: 'Салата',
        unitPriceCents: 1250,
        quantity: 2,
      })
    }
  })

  it('rejects empty name', () => {
    const result = validateReceiptImportRow({ ...validRow, name: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.name).toBeTruthy()
  })

  it('rejects whitespace-only name', () => {
    const result = validateReceiptImportRow({ ...validRow, name: '   ' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.name).toBeTruthy()
  })

  it('rejects invalid price', () => {
    const result = validateReceiptImportRow({ ...validRow, priceInput: 'abc' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.price).toBeTruthy()
  })

  it('rejects empty price', () => {
    const result = validateReceiptImportRow({ ...validRow, priceInput: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.price).toBeTruthy()
  })

  it('allows zero price', () => {
    const result = validateReceiptImportRow({ ...validRow, priceInput: '0,00' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.unitPriceCents).toBe(0)
  })

  it('rejects invalid quantity', () => {
    for (const quantityInput of ['', '0', 'abc']) {
      const result = validateReceiptImportRow({ ...validRow, quantityInput })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.fieldErrors.quantity).toBeTruthy()
    }
  })
})

describe('validateReceiptImportSelection', () => {
  it('ignores unchecked invalid rows', () => {
    const result = validateReceiptImportSelection([
      { checked: false, ...validRow, name: '' },
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual([])
      expect(result.checkedIndexes).toEqual([])
    }
  })

  it('returns rowErrors for checked invalid row', () => {
    const result = validateReceiptImportSelection([
      { checked: true, ...validRow, name: '' },
      { checked: true, ...validRow },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.rowErrors[0].name).toBeTruthy()
      expect(result.rowErrors[1]).toBeUndefined()
      expect(result.checkedCount).toBe(2)
    }
  })

  it('returns data and indexes for all checked valid rows', () => {
    const result = validateReceiptImportSelection([
      { checked: false, ...validRow, name: 'Skip' },
      { checked: true, ...validRow },
      { checked: true, name: 'Хляб', priceInput: '1,00', quantityInput: '1' },
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(2)
      expect(result.checkedIndexes).toEqual([1, 2])
    }
  })
})

describe('validateReceiptImportItems', () => {
  it('validates batch of normalized items', () => {
    const result = validateReceiptImportItems([
      { name: 'Салата', unitPriceCents: 1250, quantity: 2 },
      { name: 'Хляб', unitPriceCents: 100, quantity: 1 },
    ])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toHaveLength(2)
  })

  it('returns indexed message on failure', () => {
    const result = validateReceiptImportItems([
      { name: 'Ок', unitPriceCents: 100, quantity: 1 },
      { name: '', unitPriceCents: 100, quantity: 1 },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Артикул 2:')
      expect(result.index).toBe(1)
    }
  })
})
