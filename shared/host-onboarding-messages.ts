/** Bulgarian copy for first-time Host onboarding (#63). */

export const HOST_ONBOARDING_WELCOME = {
  introTitle: 'Добре дошли!',
  introBody:
    'Направете първата си сметка стъпка по стъпка — от касовата бележка до споделянето с гостите.',
  introPrimary: 'Да започваме',
  introSecondary: 'Не сега',
  nameTitle: 'Как да ви виждат гостите?',
  nameBody: 'Това е вашето място като участник в сметката.',
  nameFieldLabel: 'Вашето име в сметките',
  nameHelper: 'Може да го промените по-късно от Профил.',
  namePrimary: 'Създай първата сметка',
  nameEmptyError: 'Името не може да е празно',
  existingBillsBlocked:
    'Първоначалните напътствия са само когато все още нямате сметки. Изтрийте съществуващите сметки или създайте нова от началната страница.',
} as const

export const HOST_ONBOARDING_HOME = {
  resumeGuidedBill: 'Продължи първата сметка',
  startNewGuidedBill: 'Започни нова сметка с напътствия',
  stopGuidance: 'Спри напътствията',
  helpAndGuidance: 'Помощ и напътствия',
  replayToast: 'Напътствията са включени за тази сесия.',
} as const

export const HOST_ONBOARDING_STEP_BAR = {
  guidanceOn: 'Напътствията са включени',
  nextStepPrefix: 'Следваща стъпка:',
  dismissHint: 'Скрий напътствието',
  goToStep: (step: number) => `Към стъпка ${step}`,
} as const

export const HOST_ONBOARDING_PAYMENT_CHECKPOINT = {
  title: 'Как да ви платят гостите?',
  body: 'Добавете Revolut или IBAN, за да могат гостите да ви платят директно от сметката. Без тях сметката пак може да бъде споделена, но плащането трябва да се уговори в брой или по друг начин. Това питане няма да се появи отново.',
  setupPrimary: 'Настрой плащане',
  shareWithoutPayment: 'Сподели без начин на плащане',
  formTitle: 'Настройки за плащане',
  saveAndShare: 'Запази и сподели',
  back: 'Назад',
} as const

export const HOST_ONBOARDING_HANDOFF = {
  title: 'Готово! Сметката е при гостите',
  body: 'Следете плащанията в „Преглед" и завършете сметката, когато всички са платили.',
} as const

export const HOST_ONBOARDING_CONTENT_ROUTE = {
  title: 'Изберете как да въведете сметката',
  body: 'При дълга бележка снимката е по-бърза; при няколко артикула въведете ги ръчно.',
  scan: 'Снимай бележката',
  manual: 'Въведи ръчно',
} as const
