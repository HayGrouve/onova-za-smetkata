import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { formatEurInput, parseEurInputStrict } from './eur'
import { EUR_CENTS_MAX } from './constants'

describe('parseEurInputStrict', () => {
  it('parses comma decimal input', () => {
    expect(parseEurInputStrict('12,50')).toEqual({ ok: true, cents: 1250 })
  })

  it('parses dot decimal input', () => {
    expect(parseEurInputStrict('12.50')).toEqual({ ok: true, cents: 1250 })
  })

  it('accepts spaces that group thousands', () => {
    expect(parseEurInputStrict('1 234,50')).toEqual({ ok: true, cents: 123450 })
    expect(parseEurInputStrict('1\u00a0234')).toEqual({
      ok: true,
      cents: 123400,
    })
    expect(parseEurInputStrict('4,5')).toEqual({ ok: true, cents: 450 })
  })

  it('accepts cents typed without the leading zero', () => {
    expect(parseEurInputStrict(',50')).toEqual({ ok: true, cents: 50 })
    expect(parseEurInputStrict('.5')).toEqual({ ok: true, cents: 50 })
    expect(parseEurInputStrict(',').ok).toBe(false)
  })

  it('rejects input it would otherwise read only in part', () => {
    // parseFloat stops at the first stray character: 12 345,67 became 12,00 €.
    for (const input of [
      '12 345,67',
      '1.234,50',
      '1,234.50',
      '1e3',
      '12abc',
      '1,2,3',
      '12 3',
      '0x10',
      '4,567',
    ]) {
      expect(parseEurInputStrict(input)).toEqual({
        ok: false,
        message: 'Невалидна сума.',
      })
    }
  })

  it('rejects empty input', () => {
    expect(parseEurInputStrict('')).toEqual({
      ok: false,
      message: 'Невалидна сума.',
    })
  })

  it('rejects non-numeric input', () => {
    expect(parseEurInputStrict('abc')).toEqual({
      ok: false,
      message: 'Невалидна сума.',
    })
  })

  it('rejects negative input', () => {
    expect(parseEurInputStrict('-1')).toEqual({
      ok: false,
      message: 'Невалидна сума.',
    })
  })

  it('rejects overflow', () => {
    const tooMuch = (EUR_CENTS_MAX / 100 + 1).toFixed(2)
    expect(parseEurInputStrict(tooMuch)).toEqual({
      ok: false,
      message: 'Невалидна сума.',
    })
  })
})

describe('formatEurInput', () => {
  it('shows cents with a decimal comma and no symbol', () => {
    expect(formatEurInput(1250)).toBe('12,50')
    expect(formatEurInput(5)).toBe('0,05')
    expect(formatEurInput(0)).toBe('0,00')
  })

  it('reads back as the same cents', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: EUR_CENTS_MAX }), (cents) => {
        expect(parseEurInputStrict(formatEurInput(cents))).toEqual({
          ok: true,
          cents,
        })
      }),
    )
  })
})
