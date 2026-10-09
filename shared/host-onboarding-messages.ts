/** Bulgarian copy for first-time Host onboarding (#63). */

export const HOST_ONBOARDING_WELCOME = {
  introTitle: 'Добре дошли!',
  introBody:
    'Направете първата си сметка стъпка по стъпка — от касовата бележка до споделянето с гостите.',
  introPrimary: 'Да започваме',
  introSecondary: 'Не сега',
  creating: 'Създаване...',
  existingBillsTitle: 'Вече имате сметки',
  existingBillsBlocked:
    'Първоначалните напътствия са само когато все още нямате сметки. Можете да започнете нова сметка с напътствия или да затворите този прозорец.',
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
  title: 'Как да ви платят гостите?',
  body: 'Добавете Revolut или IBAN, за да могат гостите да ви платят директно от сметката. Без тях сметката пак може да бъде споделена, но плащането трябва да се уговори в брой или по друг начин. Това питане няма да се появи отново.',
  setupPrimary: 'Настрой плащане',
  shareWithoutPayment: 'Сподели без начин на плащане',
  formTitle: 'Настройки за плащане',
  saveAndShare: 'Запази и сподели',
  needOneMethod: 'Въведете Revolut потребителско име или IBAN.',
  back: 'Назад',
} as const

export const HOST_ONBOARDING_SHARE = {
  titleReady: 'Споделете сметката с гостите',
  bodyReady:
    'Сметката е готова за споделяне — може да я редактирате и след това.',
  titleNotReady: 'Довършете подготовката',
  bodyNotReady: 'Щом всичко е разпределено, споделете линка оттук.',
} as const

export const HOST_ONBOARDING_REVIEW = {
  title: 'Прегледайте сметката',
  body: 'Следете плащанията по бележките на хората и приключете сметката, когато всички са платили.',
} as const

export const HOST_ONBOARDING_HANDOFF = {
  title: 'Готово! Сметката е при гостите',
  body: 'На масата виждате кой какво взема. Приключете сметката, когато всички са платили.',
} as const

export const HOST_ONBOARDING_CONTENT_ROUTE = {
  title: 'Изберете как да въведете сметката',
  body: 'При дълга бележка снимката е по-бърза; при няколко артикула въведете ги ръчно.',
  scan: 'Снимай',
  manual: 'Въведи ръчно',
} as const

export const HOST_ONBOARDING_SCAN = {
  uploadTitle: 'Снимайте цялата бележка',
  uploadBody:
    'Хванете всички редове в кадър — така цените се разчитат по-точно.',
  runOcrTitle: 'Стартирайте разпознаването',
  runOcrBody:
    'Натиснете „Разпознай редовете“, за да извлечем ресторанта и редовете от снимката.',
  processingTitle: 'Разпознаване на бележката…',
  processingBody:
    'Четем снимката и търсим ресторант, артикули и суми. Обикновено отнема няколко секунди.',
  reviewTitle: 'Изберете какво е на масата',
  reviewBody:
    'Оставете само редовете от вашата маса, а тези с „?“ сверете с бележката.',
} as const

export const HOST_ONBOARDING_ITEMS = {
  title: 'Добавете артикулите',
  body: 'Наименование и цена са достатъчни — бройката умножава цената.',
  bodyMissingPrice: 'Без цена артикулът не влиза в дяловете.',
} as const
