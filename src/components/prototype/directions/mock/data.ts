/**
 * PROTOTYPE — sample data for the three design directions.
 * No persistence, no Convex. Field names mirror convex/schema.ts.
 */

export interface MockParticipant {
  _id: string
  name: string
  sortOrder: number
}

export interface MockItem {
  _id: string
  name: string
  unitPriceCents: number
  quantity: number
  sortOrder: number
}

export interface MockAssignment {
  itemId: string
  participantId: string
  unitIndex: number
}

export interface MockPayment {
  participantId: string
  amountCents: number
  paidAt: number
}

/** A guest said „Платих“ and the host has not confirmed yet. */
export interface MockPendingPayment {
  participantId: string
  amountCents: number
  reportedAt: number
  /** Seat whose phone reported it (covers combined payments). */
  byParticipantId: string
}

export interface MockBill {
  _id: string
  restaurantName: string
  date: number
  status: 'draft' | 'final'
  tipPercent: number
  hostParticipantId: string
  participants: MockParticipant[]
  items: MockItem[]
  assignments: MockAssignment[]
  payments: MockPayment[]
  pending: MockPendingPayment[]
  /** Seats locked to some phone; value = seat id of the phone's own seat. */
  seatPhones: Record<string, string>
}

/** Summary rows for the host home (other bills, not editable in prototypes). */
export interface MockHomeBill {
  _id: string
  restaurantName: string | null
  date: number
  status: 'draft' | 'final'
  totalCents: number
  outstandingCents: number
  guestCount: number
  paidGuestCount: number
  unassignedUnits: number
  debtors: Array<{ name: string; cents: number }>
}

export interface MockActivity {
  id: string
  at: number
  participantId: string
  kind: 'joined' | 'took' | 'released' | 'shared' | 'paid' | 'confirmed'
  text: string
}

const DAY = 86_400_000
const now = Date.now()

export const HOST_ID = 'p-host'

export const PARTICIPANTS: MockParticipant[] = [
  { _id: HOST_ID, name: 'Даниел', sortOrder: 0 },
  { _id: 'p-mila', name: 'Мила', sortOrder: 1 },
  { _id: 'p-yavor', name: 'Явор', sortOrder: 2 },
  { _id: 'p-desi', name: 'Деси', sortOrder: 3 },
  { _id: 'p-bobi', name: 'Боби', sortOrder: 4 },
]

export const ITEMS: MockItem[] = [
  {
    _id: 'i-shopska',
    name: 'Шопска салата',
    unitPriceCents: 690,
    quantity: 2,
    sortOrder: 0,
  },
  {
    _id: 'i-tarator',
    name: 'Таратор',
    unitPriceCents: 380,
    quantity: 1,
    sortOrder: 1,
  },
  {
    _id: 'i-kebapche',
    name: 'Кебапчета (3 бр.)',
    unitPriceCents: 540,
    quantity: 2,
    sortOrder: 2,
  },
  {
    _id: 'i-svinsko',
    name: 'Свинско по селски',
    unitPriceCents: 1190,
    quantity: 1,
    sortOrder: 3,
  },
  {
    _id: 'i-pileshko',
    name: 'Пилешка пържола',
    unitPriceCents: 980,
    quantity: 1,
    sortOrder: 4,
  },
  {
    _id: 'i-kartofi',
    name: 'Картофи със сирене',
    unitPriceCents: 460,
    quantity: 2,
    sortOrder: 5,
  },
  {
    _id: 'i-bira',
    name: 'Бира Загорка 0,5',
    unitPriceCents: 290,
    quantity: 6,
    sortOrder: 6,
  },
  {
    _id: 'i-rakia',
    name: 'Ракия Бургаска',
    unitPriceCents: 350,
    quantity: 3,
    sortOrder: 7,
  },
  {
    _id: 'i-voda',
    name: 'Минерална вода',
    unitPriceCents: 190,
    quantity: 2,
    sortOrder: 8,
  },
  {
    _id: 'i-palachinka',
    name: 'Палачинка с шоколад',
    unitPriceCents: 420,
    quantity: 1,
    sortOrder: 9,
  },
]

/** Mid-dinner: link shared, Явор and Деси joined and claimed some things. */
const ASSIGNMENTS: MockAssignment[] = [
  { itemId: 'i-shopska', participantId: HOST_ID, unitIndex: 0 },
  { itemId: 'i-svinsko', participantId: HOST_ID, unitIndex: 0 },
  { itemId: 'i-bira', participantId: HOST_ID, unitIndex: 0 },
  { itemId: 'i-kebapche', participantId: 'p-yavor', unitIndex: 0 },
  { itemId: 'i-bira', participantId: 'p-yavor', unitIndex: 1 },
  { itemId: 'i-bira', participantId: 'p-yavor', unitIndex: 2 },
  { itemId: 'i-rakia', participantId: 'p-yavor', unitIndex: 0 },
  { itemId: 'i-pileshko', participantId: 'p-desi', unitIndex: 0 },
  { itemId: 'i-voda', participantId: 'p-desi', unitIndex: 0 },
  { itemId: 'i-kartofi', participantId: 'p-desi', unitIndex: 0 },
  { itemId: 'i-kartofi', participantId: 'p-yavor', unitIndex: 0 },
]

export function createSeedBill(): MockBill {
  return {
    _id: 'b-chuchura',
    restaurantName: 'Механа Чучура',
    date: now - 2 * 3_600_000,
    status: 'draft',
    tipPercent: 10,
    hostParticipantId: HOST_ID,
    participants: PARTICIPANTS.map((p) => ({ ...p })),
    items: ITEMS.map((i) => ({ ...i })),
    assignments: ASSIGNMENTS.map((a) => ({ ...a })),
    payments: [],
    pending: [],
    seatPhones: { 'p-yavor': 'p-yavor', 'p-desi': 'p-desi' },
  }
}

/** Empty bill used by „Нова сметка“ flows. */
export function createEmptyBill(): MockBill {
  return {
    _id: `b-new-${Math.round(Math.random() * 1e6)}`,
    restaurantName: '',
    date: Date.now(),
    status: 'draft',
    tipPercent: 10,
    hostParticipantId: HOST_ID,
    participants: [{ _id: HOST_ID, name: 'Даниел', sortOrder: 0 }],
    items: [],
    assignments: [],
    payments: [],
    pending: [],
    seatPhones: {},
  }
}

/** What the simulated receipt OCR returns (a different restaurant). */
export const SCANNED_RECEIPT: {
  restaurantName: string
  items: Omit<MockItem, '_id' | 'sortOrder'>[]
} = {
  restaurantName: 'Хаджидраганови къщи',
  items: [
    { name: 'Снежанка', unitPriceCents: 420, quantity: 2 },
    { name: 'Сач пилешки', unitPriceCents: 1680, quantity: 1 },
    { name: 'Пълнени чушки', unitPriceCents: 890, quantity: 2 },
    { name: 'Хляб с чесън', unitPriceCents: 310, quantity: 2 },
    { name: 'Наливно червено 0,5', unitPriceCents: 1150, quantity: 1 },
    { name: 'Айран', unitPriceCents: 240, quantity: 3 },
  ],
}

/** Friends the host has split with before (for quick-add chips). */
export const RECENT_FRIENDS = [
  'Мила',
  'Явор',
  'Деси',
  'Боби',
  'Краси',
  'Ния',
  'Огнян',
]

export const HOME_BILLS: MockHomeBill[] = [
  {
    _id: 'b-happy',
    restaurantName: 'Happy Bar & Grill',
    date: now - 2 * DAY,
    status: 'draft',
    totalCents: 8740,
    outstandingCents: 2560,
    guestCount: 3,
    paidGuestCount: 1,
    unassignedUnits: 0,
    debtors: [
      { name: 'Явор', cents: 1840 },
      { name: 'Краси', cents: 720 },
    ],
  },
  {
    _id: 'b-draft',
    restaurantName: null,
    date: now - 1 * DAY,
    status: 'draft',
    totalCents: 3120,
    outstandingCents: 0,
    guestCount: 0,
    paidGuestCount: 0,
    unassignedUnits: 7,
    debtors: [],
  },
  {
    _id: 'b-pirates',
    restaurantName: 'Пиратска кръчма',
    date: now - 9 * DAY,
    status: 'final',
    totalCents: 12460,
    outstandingCents: 0,
    guestCount: 5,
    paidGuestCount: 5,
    unassignedUnits: 0,
    debtors: [],
  },
  {
    _id: 'b-made',
    restaurantName: 'Made in Home',
    date: now - 16 * DAY,
    status: 'final',
    totalCents: 6390,
    outstandingCents: 0,
    guestCount: 2,
    paidGuestCount: 2,
    unassignedUnits: 0,
    debtors: [],
  },
  {
    _id: 'b-sky',
    restaurantName: 'Sky Bar Sofia',
    date: now - 31 * DAY,
    status: 'final',
    totalCents: 18920,
    outstandingCents: 0,
    guestCount: 6,
    paidGuestCount: 6,
    unassignedUnits: 0,
    debtors: [],
  },
]

/** Host payout details (what guests pay into). */
export const HOST_PAYOUT = {
  revolutTag: 'danielp',
  iban: 'BG80 BNBG 9661 1020 3456 78',
  holder: 'Даниел Петров',
}
