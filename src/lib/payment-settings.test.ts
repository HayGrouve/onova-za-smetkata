import { describe, expect, it } from 'vitest'
import {
  buildRevolutPaymentNote,
  buildRevolutUrl,
  getPaymentSettingsStatus,
} from './payment-settings.ts'

describe('getForGuest payment settings contract', () => {
  it('exposes revolutUsername and iban for guests', () => {
    const guestPaymentKeys = ['revolutUsername', 'iban']
    expect(guestPaymentKeys).toContain('revolutUsername')
    expect(guestPaymentKeys).toContain('iban')
  })

  it('does not expose Username / profile identity', () => {
    const guestPaymentKeys = ['revolutUsername', 'iban']
    expect(guestPaymentKeys).not.toContain('username')
    expect(guestPaymentKeys).not.toContain('hostDisplayName')
  })
})

describe('getPaymentSettingsStatus', () => {
  it('returns loading while settings are unresolved', () => {
    expect(getPaymentSettingsStatus(undefined)).toBe('loading')
  })

  it('returns configured when revolut or iban is set', () => {
    expect(getPaymentSettingsStatus({ revolutUsername: 'user' })).toBe(
      'configured',
    )
    expect(getPaymentSettingsStatus({ iban: 'BG00TEST' })).toBe('configured')
  })

  it('returns unconfigured for empty settings', () => {
    expect(getPaymentSettingsStatus(null)).toBe('unconfigured')
    expect(getPaymentSettingsStatus({})).toBe('unconfigured')
  })
})

describe('buildRevolutUrl', () => {
  it('builds revolut.me link with amount in cents and EUR currency', () => {
    expect(buildRevolutUrl('yourname', 1250)).toBe(
      'https://revolut.me/yourname?amount=1250&currency=EUR',
    )
    expect(buildRevolutUrl('haygrouve', 5783)).toBe(
      'https://revolut.me/haygrouve?amount=5783&currency=EUR',
    )
  })

  it('strips @ prefix from username', () => {
    expect(buildRevolutUrl('@yourname', 500)).toBe(
      'https://revolut.me/yourname?amount=500&currency=EUR',
    )
  })

  it('includes URL-encoded note when provided', () => {
    expect(
      buildRevolutUrl('yourname', 1250, 'Pizza Palace сметка за Иван и Мария'),
    ).toBe(
      'https://revolut.me/yourname?amount=1250&currency=EUR&note=Pizza+Palace+%D1%81%D0%BC%D0%B5%D1%82%D0%BA%D0%B0+%D0%B7%D0%B0+%D0%98%D0%B2%D0%B0%D0%BD+%D0%B8+%D0%9C%D0%B0%D1%80%D0%B8%D1%8F',
    )
  })
})

describe('buildRevolutPaymentNote', () => {
  it('returns restaurant and payer for solo payment', () => {
    expect(buildRevolutPaymentNote('Pizza Palace', ['Иван'])).toBe(
      'Pizza Palace сметка за Иван',
    )
  })

  it('returns restaurant and participants for combined payment', () => {
    expect(buildRevolutPaymentNote('Pizza Palace', ['Иван', 'Мария'])).toBe(
      'Pizza Palace сметка за Иван и Мария',
    )
  })

  it('omits restaurant when name is empty', () => {
    expect(buildRevolutPaymentNote('', ['Иван'])).toBe('сметка за Иван')
    expect(buildRevolutPaymentNote('', ['Иван', 'Мария'])).toBe(
      'сметка за Иван и Мария',
    )
  })
})
