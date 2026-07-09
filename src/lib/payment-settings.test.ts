import { describe, expect, it } from 'vitest'
import {
  buildRevolutUrl,
  getPaymentSettingsStatus,
} from './payment-settings.ts'

describe('getForGuest payment settings contract', () => {
  it('exposes revolutUsername and iban for guests', () => {
    const guestPaymentKeys = ['revolutUsername', 'iban']
    expect(guestPaymentKeys).toContain('revolutUsername')
    expect(guestPaymentKeys).toContain('iban')
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
})
