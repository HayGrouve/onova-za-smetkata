import { calculateBillTotals } from './bill-calculations'
import type {
  AssignmentInput,
  ItemInput,
  ParticipantInput,
  PaymentInput,
} from './bill-calculations'
import {
  hasPricedItems,
  isPreparedBillFromParticipants,
  isRestaurantReady,
} from './bill-readiness'
import { getBillStepCompletion } from './bill-step-completion'
import type { BillStepNumber } from './bill-step-completion'
import { isHostParticipant } from './host-bill-participant'
import { countItemsWithEmptyUnits } from './unit-coverage'

/** What the Host should do next with a bill on the home screen. */
export type BillNextAction = 'finish' | 'collect' | 'close' | 'done'

/** Next action for a draft bill (never `done`). */
export type OpenBillNextAction = Exclude<BillNextAction, 'done'>

/** One Guest's Share and payments on a bill. Host seat is never included. */
export interface GuestBalance {
  participantId: string
  name: string
  owedCents: number
  paidCents: number
  /** max(0, owed − paid) — overpayment never goes negative. */
  outstandingCents: number
}

export interface CollectionParticipantInput extends ParticipantInput {
  name: string
}

export interface BillCollectionInput {
  restaurantName: string
  participants: CollectionParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
  payments: PaymentInput[]
  tipCents?: number
  hostParticipantId?: string
}

export interface BillCollectionFields {
  outstandingCents: number
  /** Sum over Guests of min(paid, owed). */
  collectedCents: number
  guestBalances: GuestBalance[]
  /** Prepared bill milestone (`shared/bill-readiness.ts`). */
  prepared: boolean
  /** First incomplete editor step among 1–3, else 4. */
  firstIncompleteStep: BillStepNumber
  unassignedItemCount: number
  hasPricedItems: boolean
  guestCount: number
  /** Guests with a positive Share who paid it in full. */
  paidGuestCount: number
}

export function toGuestBalance(input: {
  participantId: string
  name: string
  owedCents: number
  paidCents: number
}): GuestBalance {
  return {
    participantId: input.participantId,
    name: input.name,
    owedCents: input.owedCents,
    paidCents: input.paidCents,
    outstandingCents: Math.max(0, input.owedCents - input.paidCents),
  }
}

function isPaidGuest(balance: GuestBalance): boolean {
  return balance.owedCents > 0 && balance.paidCents >= balance.owedCents
}

export function countPaidGuests(balances: GuestBalance[]): number {
  return balances.filter(isPaidGuest).length
}

function sumCents<T>(values: T[], pick: (value: T) => number): number {
  return values.reduce((sum, value) => sum + pick(value), 0)
}

function firstIncompleteEditorStep(input: BillCollectionInput): BillStepNumber {
  const completion = getBillStepCompletion(input)
  for (const step of [1, 2, 3] as const) {
    if (!completion[step]) return step
  }
  return 4
}

export function buildBillCollectionFields(
  input: BillCollectionInput,
): BillCollectionFields {
  const totals = calculateBillTotals({
    participants: input.participants,
    items: input.items,
    assignments: input.assignments,
    payments: input.payments,
    tipCents: input.tipCents,
    hostParticipantId: input.hostParticipantId,
  })

  const guestBalances = input.participants
    .filter(
      (participant) =>
        !isHostParticipant(participant.id, input.hostParticipantId),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((participant) => {
      const participantTotals = totals.byParticipant[participant.id]
      return toGuestBalance({
        participantId: participant.id,
        name: participant.name,
        owedCents: participantTotals.owedCents,
        paidCents: participantTotals.paidCents,
      })
    })

  return {
    outstandingCents: sumCents(guestBalances, (b) => b.outstandingCents),
    collectedCents: sumCents(guestBalances, (b) =>
      Math.max(0, Math.min(b.paidCents, b.owedCents)),
    ),
    guestBalances,
    prepared: isPreparedBillFromParticipants(input),
    firstIncompleteStep: firstIncompleteEditorStep(input),
    unassignedItemCount: countItemsWithEmptyUnits(
      input.items,
      input.assignments,
    ),
    hasPricedItems: hasPricedItems(input.items),
    guestCount: guestBalances.length,
    paidGuestCount: countPaidGuests(guestBalances),
  }
}

interface NextActionInput {
  prepared: boolean
  outstandingCents: number
}

export function deriveBillNextAction(
  input: NextActionInput & { status: 'draft' },
): OpenBillNextAction
export function deriveBillNextAction(
  input: NextActionInput & { status: 'draft' | 'final' },
): BillNextAction
export function deriveBillNextAction(
  input: NextActionInput & { status: 'draft' | 'final' },
): BillNextAction {
  if (input.status === 'final') return 'done'
  if (!input.prepared) return 'finish'
  return input.outstandingCents > 0 ? 'collect' : 'close'
}

/**
 * Short Bulgarian hint for a `finish` bill: the first Prepared bill conjunct
 * that is missing, or null when the bill is prepared.
 */
export function describeMissingForBill(input: {
  restaurantName: string
  guestCount: number
  hasPricedItems: boolean
  unassignedItemCount: number
}): string | null {
  if (!isRestaurantReady(input.restaurantName)) return 'Липсва ресторант'
  if (input.guestCount < 1) return 'Няма гости'
  if (!input.hasPricedItems) return 'Няма артикули с цена'
  if (input.unassignedItemCount > 0) {
    return input.unassignedItemCount === 1
      ? '1 неразпределен'
      : `${input.unassignedItemCount} неразпределени`
  }
  return null
}

function collapseName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ')
}

/** Key for merging the same person across bills by name. */
export function normalizeDebtorKey(name: string): string {
  return collapseName(name).toLowerCase()
}

export interface DebtorBill<TBillId extends string = string> {
  billId: TBillId
  restaurantName: string
  date: number
  outstandingCents: number
  shareToken?: string
}

export interface Debtor<TBillId extends string = string> {
  key: string
  /** First-seen display name. */
  name: string
  outstandingCents: number
  /** Sorted by outstanding desc. */
  bills: DebtorBill<TBillId>[]
}

export interface DebtorBillInput<TBillId extends string = string> {
  billId: TBillId
  restaurantName: string
  date: number
  shareToken?: string
  guestBalances: GuestBalance[]
}

/**
 * People who still owe the Host, merged by name across bills
 * (`normalizeDebtorKey`), sorted by outstanding desc then name.
 */
export function aggregateDebtors<TBillId extends string = string>(
  bills: DebtorBillInput<TBillId>[],
): Debtor<TBillId>[] {
  const byKey = new Map<string, Debtor<TBillId>>()

  for (const bill of bills) {
    for (const balance of bill.guestBalances) {
      if (balance.outstandingCents <= 0) continue

      const key = normalizeDebtorKey(balance.name)
      let debtor = byKey.get(key)
      if (!debtor) {
        debtor = {
          key,
          name: collapseName(balance.name),
          outstandingCents: 0,
          bills: [],
        }
        byKey.set(key, debtor)
      }
      debtor.outstandingCents += balance.outstandingCents

      const existing = debtor.bills.find((b) => b.billId === bill.billId)
      if (existing) {
        existing.outstandingCents += balance.outstandingCents
        continue
      }
      debtor.bills.push({
        billId: bill.billId,
        restaurantName: bill.restaurantName,
        date: bill.date,
        outstandingCents: balance.outstandingCents,
        ...(bill.shareToken !== undefined
          ? { shareToken: bill.shareToken }
          : {}),
      })
    }
  }

  const debtors = [...byKey.values()]
  for (const debtor of debtors) {
    debtor.bills.sort(
      (a, b) => b.outstandingCents - a.outstandingCents || b.date - a.date,
    )
  }
  return debtors.sort(
    (a, b) =>
      b.outstandingCents - a.outstandingCents ||
      a.name.localeCompare(b.name, 'bg'),
  )
}
