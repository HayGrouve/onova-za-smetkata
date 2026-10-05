import type {
  BillBreakdownInput,
  BillTotals,
  ParticipantInput,
} from './bill-calculations'
import { toBillCalculationSnapshot } from './bill-calculation-snapshot'
import {
  buildClaimGroupSeatView,
  groupClaimItems,
  indexUnitMembers,
  unitKey,
} from './claim-groups'
import type { ClaimGroup, ClaimGroupSeatView, UnitRef } from './claim-groups'
import { getCoveredParticipantIds } from './combined-payment'

/** A seat's state on the rail and its Slip. */
export type SeatStatus = 'host' | 'paid' | 'pending' | 'owes' | 'empty'

/** A Sent Pay request that pays for a seat and awaits the Host. */
export interface SentTransfer {
  requestId: string
  totalCents: number
  /** Who sent it; a covered seat's Slip points at them. */
  payerId: string
}

/** What a seat owes and has left, as one phone may know it. */
export interface SeatMoney {
  owedCents: number
  remainingCents: number
  sent: SentTransfer | null
}

/**
 * Per-seat money from the bill's totals and the Sent Pay requests a phone may
 * see: the Host sees every one, a Guest phone only its own.
 */
export function buildSeatLedger(input: {
  totals: BillTotals
  sentRequests: ReadonlyArray<{
    _id: string
    totalCents: number
    payerParticipantId: string
    coveredParticipantIds?: string[]
    coveredParticipantId?: string
  }>
}): Record<string, SeatMoney> {
  const sentBySeat = new Map<string, SentTransfer>()
  for (const request of input.sentRequests) {
    const sent: SentTransfer = {
      requestId: request._id,
      totalCents: request.totalCents,
      payerId: request.payerParticipantId,
    }
    sentBySeat.set(request.payerParticipantId, sent)
    for (const id of getCoveredParticipantIds(request)) {
      sentBySeat.set(id, sent)
    }
  }

  const ledger: Record<string, SeatMoney> = {}
  for (const [id, totals] of Object.entries(input.totals.byParticipant)) {
    ledger[id] = {
      owedCents: totals.owedCents,
      remainingCents: Math.max(0, totals.balanceCents),
      sent: sentBySeat.get(id) ?? null,
    }
  }
  return ledger
}

/** The one rule for a seat's Slip: the Host never owes; a sent transfer waits. */
export function seatStatus(input: {
  isHost: boolean
  money: SeatMoney | undefined
}): SeatStatus {
  if (input.isHost) return 'host'
  const money = input.money
  if (!money) return 'empty'
  if (money.sent) return 'pending'
  if (money.owedCents > 0 && money.remainingCents === 0) return 'paid'
  if (money.remainingCents > 0) return 'owes'
  return 'empty'
}

export interface LiveReceiptSeat {
  id: string
  name: string
  status: SeatStatus
  /** A phone holds this seat right now. */
  joined: boolean
  /** Units this seat is on; a shared Unit counts for each member. */
  unitCount: number
  owedCents: number
  remainingCents: number
  sent: SentTransfer | null
}

/** One short line under a seat on the rail: „на масата, 3 бр.“. */
export function seatPresenceLabel(
  seat: Pick<LiveReceiptSeat, 'status' | 'joined' | 'unitCount'>,
): string {
  if (seat.status === 'host') return 'домакин'
  if (seat.status === 'paid') return 'платено'
  if (seat.status === 'pending') return 'чака потвърждение'
  return seat.joined ? `на масата, ${seat.unitCount} бр.` : 'не е отворил линка'
}

export interface LiveReceiptInput {
  participants: ReadonlyArray<{ _id: string; name: string; sortOrder: number }>
  items: ReadonlyArray<{
    _id: string
    name: string
    quantity: number
    sortOrder: number
    unitPriceCents: number
  }>
  assignments: ReadonlyArray<{
    itemId: string
    participantId: string
    unitIndex: number
  }>
  tipCents?: number
  hostParticipantId?: string
  /** What each seat owes and has left, as this phone may know it. */
  seatMoney: Partial<Record<string, SeatMoney>>
  /** Seats a phone holds right now. */
  joinedSeatIds: readonly string[]
}

export interface LiveReceipt {
  /** One line per Claim group, in receipt order. */
  lines: ClaimGroup[]
  /** Who is on a Unit. */
  membersOf: (unit: UnitRef) => string[]
  /** A line as one seat sees it: free Units, its own, shared ones. */
  lineFor: (line: ClaimGroup, seatId: string) => ClaimGroupSeatView
  subtotalCents: number
  tipCents: number
  totalUnits: number
  freeUnits: number
  freeCents: number
  /** Seats in table order, for Unit splits and seat pickers. */
  seatOrder: ParticipantInput[]
  /** The people around the table, in table order. */
  seats: LiveReceiptSeat[]
  seat: (id: string) => LiveReceiptSeat | undefined
  /** What Guests still owe; the Host never is Outstanding. */
  outstandingCents: number
  /** Input for one seat's Share lines. */
  breakdownInput: BillBreakdownInput
}

/**
 * The Live receipt as one phone sees it. The Host's phone and a Guest's phone
 * build it from the same rules; only `seatMoney` differs, by what each may know.
 */
export function buildLiveReceipt(input: LiveReceiptInput): LiveReceipt {
  const lines = groupClaimItems(
    input.items.map((item) => ({
      id: item._id,
      name: item.name,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      sortOrder: item.sortOrder,
    })),
  )
  const assignments = input.assignments.map((assignment) => ({
    itemId: assignment.itemId,
    participantId: assignment.participantId,
    unitIndex: assignment.unitIndex,
  }))
  const membersByUnit = indexUnitMembers(assignments)
  const membersOf = (unit: UnitRef) => membersByUnit.get(unitKey(unit)) ?? []

  let totalUnits = 0
  let freeUnits = 0
  let freeCents = 0
  for (const line of lines) {
    for (const unit of line.units) {
      totalUnits += 1
      if (membersOf(unit).length === 0) {
        freeUnits += 1
        freeCents += line.unitPriceCents
      }
    }
  }

  const tipCents = input.tipCents ?? 0
  const { breakdownInput } = toBillCalculationSnapshot(
    {
      participants: [...input.participants],
      items: [...input.items],
      assignments,
      payments: [],
    },
    { tipCents, hostParticipantId: input.hostParticipantId },
  )
  const seatOrder = breakdownInput.participants

  const unitCounts = new Map<string, number>()
  for (const assignment of assignments) {
    unitCounts.set(
      assignment.participantId,
      (unitCounts.get(assignment.participantId) ?? 0) + 1,
    )
  }
  const joined = new Set(input.joinedSeatIds)
  const seats: LiveReceiptSeat[] = [...input.participants]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((participant) => {
      const money = input.seatMoney[participant._id]
      return {
        id: participant._id,
        name: participant.name,
        status: seatStatus({
          isHost: participant._id === input.hostParticipantId,
          money,
        }),
        joined: joined.has(participant._id),
        unitCount: unitCounts.get(participant._id) ?? 0,
        owedCents: money?.owedCents ?? 0,
        remainingCents: money?.remainingCents ?? 0,
        sent: money?.sent ?? null,
      }
    })
  const seatsById = new Map(seats.map((seat) => [seat.id, seat]))

  return {
    lines,
    membersOf,
    lineFor: (line, seatId) =>
      buildClaimGroupSeatView({
        group: line,
        assignments,
        seatId,
        participants: seatOrder,
      }),
    subtotalCents: input.items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    ),
    tipCents,
    totalUnits,
    freeUnits,
    freeCents,
    seatOrder,
    seats,
    seat: (id) => seatsById.get(id),
    outstandingCents: seats.reduce(
      (sum, seat) => (seat.status === 'host' ? sum : sum + seat.remainingCents),
      0,
    ),
    breakdownInput,
  }
}
