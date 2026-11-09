import { bgBG } from '@clerk/localizations/bg-BG'

/** The Clerk dashboard names the app in Latin; screens say it in Cyrillic. */
const APP_NAME = 'Онова за сметката'
const CONTINUE_TO_APP = `за да продължиш към ${APP_NAME}`

/** Host-visible Bulgarian fills for community `bgBG` gaps. Clerk Billing keys stay untranslated. */
export const clerkBgLocalization = {
  ...bgBG,
  identityPreviewEditButton__emailAddress: 'Промени имейл адреса',
  identityPreviewEditButton__identifier: 'Промени',
  identityPreviewEditButton__phoneNumber: 'Промени телефонния номер',
  signIn: {
    ...bgBG.signIn,
    start: { ...bgBG.signIn?.start, title: `Вход в ${APP_NAME}` },
    emailCode: { ...bgBG.signIn?.emailCode, subtitle: CONTINUE_TO_APP },
    emailCodeMfa: { ...bgBG.signIn?.emailCodeMfa, subtitle: CONTINUE_TO_APP },
    emailLink: { ...bgBG.signIn?.emailLink, subtitle: CONTINUE_TO_APP },
    emailLinkMfa: { ...bgBG.signIn?.emailLinkMfa, subtitle: CONTINUE_TO_APP },
    phoneCode: { ...bgBG.signIn?.phoneCode, subtitle: CONTINUE_TO_APP },
  },
  signUp: {
    ...bgBG.signUp,
    emailLink: { ...bgBG.signUp?.emailLink, subtitle: CONTINUE_TO_APP },
  },
  userButton: {
    ...bgBG.userButton,
    action__openUserMenu: 'Отвори менюто на акаунта',
    action__closeUserMenu: 'Затвори менюто на акаунта',
  },
  userProfile: {
    ...bgBG.userProfile,
    mfaPhoneCodePage: {
      ...bgBG.userProfile?.mfaPhoneCodePage,
      backButton: 'Използвай съществуващ номер',
      successTitle: 'Потвърждението със SMS код е включено',
      successMessage1:
        'При вход ще трябва да въведеш код, изпратен на този телефонен номер.',
      successMessage2:
        'Запази резервните кодове на сигурно място. Ако загубиш достъп до устройството, с тях можеш да влезеш.',
    },
    phoneNumberPage: {
      ...bgBG.userProfile?.phoneNumberPage,
      verifyTitle: 'Потвърди телефонния номер',
      verifySubtitle: 'Въведи кода, изпратен на {{identifier}}',
    },
    passwordPage: {
      ...bgBG.userProfile?.passwordPage,
      checkboxInfoText__signOutOfOtherSessions:
        'Препоръчително е да излезеш от всички други устройства, които може да използват старата парола.',
    },
    passkeyScreen: {
      ...bgBG.userProfile?.passkeyScreen,
      title__rename: 'Преименуване на ключ за достъп',
      subtitle__rename: 'Можеш да смениш името, за да го намираш по-лесно.',
      removeResource: {
        ...bgBG.userProfile?.passkeyScreen?.removeResource,
        title: 'Премахване на ключ за достъп',
        messageLine1: '{{name}} ще бъде премахнат от този акаунт.',
      },
    },
    start: {
      ...bgBG.userProfile?.start,
      connectedAccountsSection: {
        ...bgBG.userProfile?.start?.connectedAccountsSection,
        subtitle__reauthorize:
          'Необходимите права са обновени и приложението може да е ограничено. Упълномощи отново, за да избегнеш проблеми.',
      },
      passkeysSection: {
        ...bgBG.userProfile?.start?.passkeysSection,
        title: 'Ключове за достъп',
        primaryButton: 'Добави ключ за достъп',
        menuAction__rename: 'Преименувай',
        menuAction__destructive: 'Премахни',
      },
    },
  },
}
