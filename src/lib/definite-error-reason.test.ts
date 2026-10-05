import { describe, expect, it } from 'vitest'
import { isDefiniteErrorReason } from './definite-error-reason.ts'

describe('isDefiniteErrorReason', () => {
  it('treats a missing bill or a dead link as final, for Host and Guest wording', () => {
    expect(isDefiniteErrorReason('Сметката не е намерена')).toBe(true)
    expect(isDefiniteErrorReason('Сметката не е намерена.')).toBe(true)
    expect(
      isDefiniteErrorReason('Невалиден или изтекъл линк за споделяне.'),
    ).toBe(true)
  })

  it('still offers a retry for anything else', () => {
    expect(isDefiniteErrorReason(null)).toBe(false)
    expect(isDefiniteErrorReason('Твърде много заявки')).toBe(false)
  })
})
