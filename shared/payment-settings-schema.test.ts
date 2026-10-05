import { describe, expect, it } from 'vitest'
import {
  formatPaymentSettingsErrors,
  isValidIbanChecksum,
  normalizeRevolutUsername,
  parsePaymentSettingsInput,
  validateIban,
} from './payment-settings-schema'

const VALID_BG_IBAN = 'BG80BNBG96611020345678'

describe('normalizeRevolutUsername', () => {
  it('strips leading @ and trims', () => {
    expect(normalizeRevolutUsername('  @haygrouve  ')).toBe('haygrouve')
    expect(normalizeRevolutUsername('user')).toBe('user')
  })
})

describe('parsePaymentSettingsInput', () => {
  it('accepts empty fields', () => {
    const result = parsePaymentSettingsInput({
      revolutUsername: '',
      iban: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({})
    }
  })

  it('normalizes revolut username with @', () => {
    const result = parsePaymentSettingsInput({
      revolutUsername: '@haygrouve',
      iban: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.revolutUsername).toBe('haygrouve')
    }
  })

  it('rejects invalid revolut username', () => {
    const result = parsePaymentSettingsInput({
      revolutUsername: 'ab',
      iban: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(formatPaymentSettingsErrors(result.error).revolutUsername).toBe(
        'Невалидно Revolut потребителско име',
      )
    }
  })

  it('accepts valid BG IBAN with checksum', () => {
    const result = parsePaymentSettingsInput({
      revolutUsername: '',
      iban: 'BG80 BNBG 9661 1020 3456 78',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.iban).toBe(VALID_BG_IBAN)
    }
  })

  it('rejects BG IBAN with bad checksum', () => {
    const result = parsePaymentSettingsInput({
      revolutUsername: '',
      iban: 'BG00BNBG96611020345678',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(formatPaymentSettingsErrors(result.error).iban).toBe(
        'Невалиден български IBAN',
      )
    }
  })

  it('accepts foreign IBAN with format only', () => {
    const result = parsePaymentSettingsInput({
      revolutUsername: '',
      iban: 'DE89370400440532013000',
    })
    expect(result.success).toBe(true)
  })
})

describe('isValidIbanChecksum', () => {
  it('validates known BG IBAN', () => {
    expect(isValidIbanChecksum(VALID_BG_IBAN)).toBe(true)
    expect(isValidIbanChecksum('BG00BNBG96611020345678')).toBe(false)
  })
})

describe('validateIban', () => {
  it('accepts a spaced lowercase BG IBAN and returns it normalized', () => {
    expect(validateIban('bg80 bnbg 9661 1020 3456 78')).toEqual({
      ok: true,
      value: VALID_BG_IBAN,
    })
  })

  it('rejects malformed input', () => {
    expect(validateIban('not an iban')).toEqual({
      ok: false,
      message: 'Невалиден формат на IBAN',
    })
  })

  it('rejects a BG IBAN with a bad checksum', () => {
    expect(validateIban('BG81BNBG96611020345678')).toEqual({
      ok: false,
      message: 'Невалиден български IBAN',
    })
  })

  it('rejects a foreign IBAN whose check digits do not add up', () => {
    // Guests copy this IBAN to pay; a typo must not reach them.
    expect(validateIban('DE00 1234 5678 9012 3456 78').ok).toBe(false)
    expect(validateIban('DE88370400440532013000').ok).toBe(false)
    expect(validateIban('DE89370400440532013000').ok).toBe(true)
  })
})
