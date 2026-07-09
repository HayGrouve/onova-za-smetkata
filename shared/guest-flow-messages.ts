export const GUEST_FLOW_MESSAGES = {
  billNotFound: 'Сметката не е намерена.',
  invalidShareLink: 'Невалиден или изтекъл линк за споделяне.',
  participantNotOnBill: 'Участникът не принадлежи на тази сметка.',
  claimRateLimitActor:
    'Твърде много опити за присъединяване. Опитайте отново след малко.',
  claimRateLimitBill:
    'Твърде много опити за присъединяване към тази сметка. Опитайте отново след малко.',
  nameTaken: 'Това име вече е заето от друг телефон.',
  sessionExpired: 'Сесията изтече. Изберете името си отново.',
  sessionRequired: 'Изисква се валидна гост-сесия.',
  billFinalNoEdit: 'Сметката е приключена и не може да се редактира.',
  sessionLostRedirect:
    'Сесията изтече или името е заето. Изберете отново.',
  invalidJoinLink:
    'Невалиден линк за присъединяване. Попитайте домакина за нов линк.',
} as const

export type GuestFlowMessageKey = keyof typeof GUEST_FLOW_MESSAGES
