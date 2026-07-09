import { describe, expect, it } from 'vitest'
import {
  parsePaymentAmountInput,
  validatePaymentAdd,
  validatePaymentAddForm,
} from './payment-amount-schema'
import { PAYMENT_NOTE_MAX } from './validation/constants'

const OVER_CAP_MESSAGE = 'Сумата надвишава дължимото.'

describe('parsePaymentAmountInput', () => {
  it('parses comma decimal', () => {
    expect(parsePaymentAmountInput('12,50')).toEqual({ ok: true, cents: 1250 })
    expect(parsePaymentAmountInput('3,99')).toEqual({ ok: true, cents: 399 })
  })

  it('rejects empty and invalid', () => {
    expect(parsePaymentAmountInput('').ok).toBe(false)
    expect(parsePaymentAmountInput('abc').ok).toBe(false)
  })
})

describe('validatePaymentAddForm', () => {
  it('accepts valid partial within remaining', () => {
    const result = validatePaymentAddForm(
      { amountInput: '12,50' },
      { remainingCents: 2000 },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.amountCents).toBe(1250)
    }
  })

  it('rejects zero amount', () => {
    const result = validatePaymentAddForm(
      { amountInput: '0,00' },
      { remainingCents: 2000 },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Сумата трябва да е положителна.')
    }
  })

  it('rejects amount over remaining', () => {
    const result = validatePaymentAddForm(
      { amountInput: '10,00' },
      { remainingCents: 500 },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe(OVER_CAP_MESSAGE)
    }
  })

  it('allows exact remaining', () => {
    const result = validatePaymentAddForm(
      { amountInput: '5,00' },
      { remainingCents: 500 },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects overlong note', () => {
    const result = validatePaymentAddForm(
      { amountInput: '1,00', note: 'x'.repeat(PAYMENT_NOTE_MAX + 1) },
      { remainingCents: 500 },
    )
    expect(result.ok).toBe(false)
  })
})

describe('validatePaymentAdd', () => {
  it('accepts valid server args', () => {
    const result = validatePaymentAdd(
      { amountCents: 500 },
      { owedCents: 1000, paidCents: 0 },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects non-positive amount', () => {
    expect(
      validatePaymentAdd({ amountCents: 0 }, { owedCents: 1000, paidCents: 0 })
        .ok,
    ).toBe(false)
  })

  it('rejects overpay', () => {
    const result = validatePaymentAdd(
      { amountCents: 600 },
      { owedCents: 1000, paidCents: 500 },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe(OVER_CAP_MESSAGE)
    }
  })

  it('allows paying exactly to owed', () => {
    const result = validatePaymentAdd(
      { amountCents: 500 },
      { owedCents: 1000, paidCents: 500 },
    )
    expect(result.ok).toBe(true)
  })

  it('normalizes blank note to undefined', () => {
    const result = validatePaymentAdd(
      { amountCents: 100, note: '   ' },
      { owedCents: 1000, paidCents: 0 },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.note).toBeUndefined()
    }
  })
})
