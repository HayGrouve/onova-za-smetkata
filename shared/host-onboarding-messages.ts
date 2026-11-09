/** Bulgarian copy for first-time Host onboarding (#63). */

export const HOST_ONBOARDING_WELCOME = {
  introTitle: 'Здравей!',
  introBody:
    'Направи първата си сметка стъпка по стъпка: от касовата бележка до споделянето с гостите.',
  introPrimary: 'Да започваме',
  introSecondary: 'Не сега',
  creating: 'Създаване...',
  existingBillsTitle: 'Вече имаш сметки',
  existingBillsBlocked:
    'Първоначалните напътствия са само докато още нямаш сметки. Можеш да започнеш нова сметка с напътствия или да затвориш този прозорец.',
  startGuidedWithExistingBills: 'Създай сметка с напътствия',
  closeWelcome: 'Затвори',
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
  /** The receipt names steps by what they hold, not by number. */
  goToStep: (step: number) =>
    ['Към бележката', 'Към хората', 'Към масата', 'Към разплащане'][step - 1] ??
    'Напред',
} as const

export const HOST_ONBOARDING_PAYMENT_CHECKPOINT = {
  title: 'Как да ти платят гостите?',
  body: 'Добави Revolut или IBAN, за да могат гостите да ти платят директно от сметката. Без тях сметката пак може да бъде споделена, но плащането трябва да се уговори в брой или по друг начин. Това питане няма да се появи отново.',
  setupPrimary: 'Настрой плащане',
  shareWithoutPayment: 'Сподели без начин на плащане',
  formTitle: 'Настройки за плащане',
  saveAndShare: 'Запази и сподели',
  needOneMethod: 'Въведи Revolut потребителско име или IBAN.',
  back: 'Назад',
} as const

export const HOST_ONBOARDING_SHARE = {
  titleReady: 'Сподели сметката с гостите',
  bodyReady:
    'Сметката е готова за споделяне. Можеш да я редактираш и след това.',
  titleNotReady: 'Довърши подготовката',
  bodyNotReady: 'Щом всичко е разпределено, сподели линка оттук.',
} as const

export const HOST_ONBOARDING_REVIEW = {
  title: 'Прегледай сметката',
  body: 'Следи плащанията по бележките на хората и приключи сметката, когато всички са платили.',
} as const

export const HOST_ONBOARDING_HANDOFF = {
  title: 'Готово! Сметката е при гостите',
  body: 'На масата виждаш кой какво взема. Приключи сметката, когато всички са платили.',
} as const

export const HOST_ONBOARDING_CONTENT_ROUTE = {
  title: 'Избери как да въведеш сметката',
  body: 'При дълга бележка снимката е по-бърза; при няколко артикула ги въведи ръчно.',
  scan: 'Снимай',
  manual: 'Въведи ръчно',
} as const

export const HOST_ONBOARDING_SCAN = {
  uploadTitle: 'Снимай цялата бележка',
  uploadBody: 'Хвани всички редове в кадър, така цените се разчитат по-точно.',
  runOcrTitle: 'Стартирай разпознаването',
  runOcrBody:
    'Натисни „Разпознай редовете“, за да извлечем ресторанта и редовете от снимката.',
  processingTitle: 'Разпознаване на бележката…',
  processingBody:
    'Четем снимката и търсим ресторант, артикули и суми. Обикновено отнема няколко секунди.',
  reviewTitle: 'Избери какво е на масата',
  reviewBody:
    'Остави само редовете от твоята маса, а тези с „?“ провери по бележката.',
} as const

export const HOST_ONBOARDING_ITEMS = {
  title: 'Добави артикулите',
  body: 'Наименование и цена са достатъчни, бройката умножава цената.',
  bodyMissingPrice: 'Без цена артикулът не влиза в дяловете.',
} as const
