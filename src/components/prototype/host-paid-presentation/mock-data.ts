/** PROTOTYPE — in-memory bill snapshot for host paid presentation. */

export interface PrototypeParticipant {
  id: string
  name: string
  role: 'host' | 'guest'
  shareCents: number
  /** Guest collection only — host never has outstanding by rule. */
  outstandingCents: number
  guestStatus: 'unpaid' | 'partial' | 'paid'
}

export const MOCK_HOST_NAME = 'Цветомир'

export const MOCK_PARTICIPANTS: PrototypeParticipant[] = [
  {
    id: 'host',
    name: MOCK_HOST_NAME,
    role: 'host',
    shareCents: 1850,
    outstandingCents: 0,
    guestStatus: 'paid',
  },
  {
    id: 'ivan',
    name: 'Иван',
    role: 'guest',
    shareCents: 2200,
    outstandingCents: 2200,
    guestStatus: 'unpaid',
  },
  {
    id: 'maria',
    name: 'Мария',
    role: 'guest',
    shareCents: 1500,
    outstandingCents: 0,
    guestStatus: 'paid',
  },
]

export const MOCK_HOST_LINES = [
  { label: 'Пица Маргарита (½)', amountCents: 650 },
  { label: 'Кола', amountCents: 400 },
  { label: 'Бакшиш', amountCents: 800 },
]

export const MOCK_BILL_TOTAL_CENTS = 5550
