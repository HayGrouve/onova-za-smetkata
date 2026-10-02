import { describe, expect, it } from 'vitest'
import { parseEurInputStrict } from './eur'
import { EUR_CENTS_MAX } from './constants'

describe('parseEurInputStrict', () => {
  it('parses comma decimal input', () => {
    expect(parseEurInputStrict('12,50')).toEqual({ ok: true, cents: 1250 })
  })

  it('parses dot decimal input', () => {
    expect(parseEurInputStrict('12.50')).toEqual({ ok: true, cents: 1250 })
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
