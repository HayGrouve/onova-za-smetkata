export const COMBINED_PAYMENT_MESSAGES = {
  sameParticipant: 'Не можеш да платиш за себе си.',
  coveredAlreadyPaid: 'Дялът на участника вече е платен.',
  payerNothingOwed: 'Нямаш оставащ дял за плащане.',
  coveredPendingExists: 'Вече има чакащо плащане за този участник.',
  requestNotFound: 'Заявката не е намерена.',
  requestNotPending: 'Заявката вече е обработена.',
  coveredPaidBeforeConfirm: 'Дялът на {name} вече е платен.',
  /** Shown to the Host: the Share shrank after the guest sent the money. */
  payerOverRemaining:
    'Дялът се промени след превода и сумата вече не съвпада. Отбележи полученото ръчно и натисни „Не виждам превода“.',
  statusPending: 'Чака потвърждение от домакина',
  payForLabel: 'Плати и за',
  combinedTotalLabel: 'Общо за плащане',
  cancelPending: 'Отмени',
  hostConfirmPrompt: 'Маркира {payer} и {covered} като платени?',
  hostBanner: '{payer} плати {total} за {payer} + {covered}',
  coveredGuestBanner: '{payer} ще плати и за теб ({amount})',
  coveredGuestHint: 'Не е нужно да плащаш отделно засега.',
  confirm: 'Потвърди',
  reject: 'Отхвърли',
  combinedPaymentNote: 'Комбинирано плащане',
  soloHostBanner: '{payer} плати {total}',
  soloHostConfirmPrompt: 'Маркира {payer} като платен?',
  transferNotInitiated: 'Първо отвори Revolut или копирай IBAN.',
  selectionLockedAfterTransfer:
    'Не можеш да промениш избора след изпращане на плащането.',
  duplicateCovered: 'Избран е един и същ участник повече от веднъж.',
  payerCoveredByOther: 'Друг гост вече плаща за теб.',
  participantHasTransfer:
    'За този участник има изпратен превод. Първо го потвърди или отхвърли.',
  transfersAwaitingHost:
    'Има изпратени преводи, които чакат потвърждение. Потвърди ги или ги отхвърли, преди да приключиш.',
} as const
