import { describe, expect, it } from 'vitest'
import { formatEur, parseEurInput } from './format-currency'

describe('formatEur', () => {
  it('formats cents as EUR in bg-BG locale', () => {
    expect(formatEur(1250)).toMatch(/12[,.]50/)
  })
})

describe('parseEurInput', () => {
  it('parses comma decimal input', () => {
    expect(parseEurInput('12,50')).toBe(1250)
  })

  it('parses dot decimal input', () => {
    expect(parseEurInput('12.50')).toBe(1250)
  })
})
