import { describe, expect, it } from 'vitest'
import {
  isGuestRouteContext,
  resolveAppHeaderRouteContext,
} from './app-header-route-context'

describe('resolveAppHeaderRouteContext', () => {
  it('treats /user-profile as Host account, not home', () => {
    expect(resolveAppHeaderRouteContext('/user-profile', '', undefined)).toBe(
      'hostAccount',
    )
  })

  it('treats UserProfile nested paths as Host account', () => {
    expect(
      resolveAppHeaderRouteContext('/user-profile/security', '', undefined),
    ).toBe('hostAccount')
  })

  it('keeps home, login, and bill routes unchanged', () => {
    expect(resolveAppHeaderRouteContext('/', '', undefined)).toBe('home')
    expect(resolveAppHeaderRouteContext('/login', '', undefined)).toBe('login')
    expect(resolveAppHeaderRouteContext('/privacy', '', undefined)).toBe('home')
    expect(
      resolveAppHeaderRouteContext('/bills/bill_1/join', '', 'bill_1'),
    ).toBe('guestJoin')
    expect(
      resolveAppHeaderRouteContext('/bills/bill_1/claim', '', 'bill_1'),
    ).toBe('guestClaim')
    expect(
      resolveAppHeaderRouteContext('/bills/bill_1/pay', '?t=abc', 'bill_1'),
    ).toBe('guestPay')
    expect(
      resolveAppHeaderRouteContext(
        '/bills/bill_1/claim',
        '?mode=host',
        'bill_1',
      ),
    ).toBe('hostClaim')
    expect(
      resolveAppHeaderRouteContext('/bills/bill_1/summary', '', 'bill_1'),
    ).toBe('summary')
    expect(resolveAppHeaderRouteContext('/bills/bill_1', '', 'bill_1')).toBe(
      'editor',
    )
  })
})

describe('isGuestRouteContext', () => {
  it('covers the guest join, claim, and pay pages only', () => {
    expect(isGuestRouteContext('guestJoin')).toBe(true)
    expect(isGuestRouteContext('guestClaim')).toBe(true)
    expect(isGuestRouteContext('guestPay')).toBe(true)
    expect(isGuestRouteContext('hostClaim')).toBe(false)
    expect(isGuestRouteContext('editor')).toBe(false)
  })
})
