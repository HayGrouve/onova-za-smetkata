import { bgBG } from '@clerk/localizations/bg-BG'
import { describe, expect, it } from 'vitest'
import { clerkBgLocalization } from './clerk-bg-localization'

describe('clerkBgLocalization', () => {
  it('keeps the community Bulgarian pack as the base', () => {
    expect(clerkBgLocalization.userButton.action__manageAccount).toBe(
      bgBG.userButton?.action__manageAccount,
    )
    expect(clerkBgLocalization.signIn?.start?.title).toBe(
      bgBG.signIn?.start?.title,
    )
  })

  it('fills Host-visible UserButton open/close labels', () => {
    expect(clerkBgLocalization.userButton.action__openUserMenu).toBe(
      'Отвори менюто на акаунта',
    )
    expect(clerkBgLocalization.userButton.action__closeUserMenu).toBe(
      'Затвори менюто на акаунта',
    )
  })

  it('overrides leftover English password, Google, passkey, and MFA strings', () => {
    expect(
      clerkBgLocalization.userProfile.passwordPage
        .checkboxInfoText__signOutOfOtherSessions,
    ).toMatch(/излезете/)
    expect(
      clerkBgLocalization.userProfile.start.connectedAccountsSection
        .subtitle__reauthorize,
    ).toMatch(/Упълномощете/)
    expect(clerkBgLocalization.userProfile.start.passkeysSection.title).toBe(
      'Ключове за достъп',
    )
    expect(clerkBgLocalization.userProfile.mfaPhoneCodePage.backButton).toBe(
      'Използвай съществуващ номер',
    )
  })

  it('does not add Clerk Billing translations', () => {
    expect(clerkBgLocalization.userProfile.billingPage).toEqual(
      bgBG.userProfile?.billingPage,
    )
    expect(clerkBgLocalization.userProfile.navbar.billing).toEqual(
      bgBG.userProfile?.navbar?.billing,
    )
  })
})
