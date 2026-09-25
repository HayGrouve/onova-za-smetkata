import type {
  BillCalculationContext,
  LoadedBillRelations,
} from './bill-calculation-snapshot'
import type { GuestItemAssignment } from './guest-claim-items'
import type { GuestClaimSessionItem } from './guest-claim-session'
import type { ParticipantInput } from './bill-calculations'
import { GUEST_FLOW_MESSAGES } from './guest-flow-messages'

export type StoredGuestSessionRef = {
  billId: string
  participantId: string
  sessionToken: string
  shareToken: string
  coveredParticipantIds?: string[]
}

export type GuestFlowBillParticipant = {
  _id: string
  name: string
  sortOrder: number
}

export type GuestFlowBillItem = {
  _id: string
  name: string
  quantity: number
  sortOrder: number
  unitPriceCents: number
}

export type GuestFlowBillAssignment = {
  itemId: string
  participantId: string
  unitIndex: number
}

export type GuestFlowBillPayment = {
  participantId: string
  amountCents: number
}

export type GuestFlowBillData = {
  bill: {
    tipCents?: number
    status: 'draft' | 'final'
    restaurantName: string
    date: number
  }
  hostParticipantId?: string
  participants: GuestFlowBillParticipant[]
  items: GuestFlowBillItem[]
  assignments: GuestFlowBillAssignment[]
  myPayments: GuestFlowBillPayment[]
  /** Seats this phone's guest session handles — own seat first, then Covered seats. */
  mySeatIds?: string[]
}

export type GuestClaimSessionInputSlice = {
  items: GuestClaimSessionItem[]
  assignments: GuestItemAssignment[]
  participants: ParticipantInput[]
  billRelations: LoadedBillRelations
  billContext: BillCalculationContext
}

export type JoinPageGate = 'loading' | 'ready'

export type ClaimPageGate =
  | { status: 'loading' }
  | {
      status: 'redirect-join'
      reason: 'missing-token' | 'missing-session' | 'participant-not-found'
    }
  | {
      status: 'ready'
      shareToken: string
      storedSession: StoredGuestSessionRef
      participantId: string
    }

export type FlowRecoveryPlan = {
  clearStorage: true
  releaseSession: boolean
  toastMessage?: string
  redirectShareToken: string
}

export type ActiveGuestSeat = {
  participantId: string
  /** Set when the seat is a Covered seat — the holder's own seat. */
  heldByParticipantId?: string
}

/**
 * Seats held by other active guest sessions (excludes the viewer's own session).
 * Value is the holder's own seat for Covered seats, `null` for someone's own seat.
 */
export function buildTakenSeats(
  activeSeats: ActiveGuestSeat[] | undefined,
  ownParticipantId: string | undefined,
): Map<string, string | null> {
  const taken = new Map<string, string | null>()
  if (!activeSeats) return taken
  for (const seat of activeSeats) {
    const holder = seat.heldByParticipantId ?? seat.participantId
    if (ownParticipantId !== undefined && holder === ownParticipantId) continue
    taken.set(seat.participantId, seat.heldByParticipantId ?? null)
  }
  return taken
}

/** Seats this phone handles, own seat first; falls back to the stored seat. */
export function resolveMySeatIds(
  data: Pick<GuestFlowBillData, 'mySeatIds' | 'participants'>,
  ownParticipantId: string,
): string[] {
  const onBill = new Set(data.participants.map((p) => p._id))
  const seats = [ownParticipantId, ...(data.mySeatIds ?? [])]
  return [...new Set(seats)].filter((id) => onBill.has(id))
}

export function shouldAttemptJoinResume(
  storedSession: StoredGuestSessionRef | null,
  urlShareToken: string,
): boolean {
  return storedSession !== null && storedSession.shareToken === urlShareToken
}

export function resolveJoinPageGate(input: {
  billData: unknown | undefined
  activeSessions: unknown | undefined
  resuming: boolean
}): JoinPageGate {
  if (
    input.billData === undefined ||
    input.activeSessions === undefined ||
    input.resuming
  ) {
    return 'loading'
  }
  return 'ready'
}

export function resolveEffectiveShareToken(
  storedSession: StoredGuestSessionRef | null,
  shareTokenFromUrl: string,
): string {
  return storedSession?.shareToken ?? shareTokenFromUrl
}

export function resolveClaimPageGate(input: {
  shareToken: string
  storedSession: StoredGuestSessionRef | null
  billData: GuestFlowBillData | undefined
}): ClaimPageGate {
  if (!input.shareToken) {
    return { status: 'redirect-join', reason: 'missing-token' }
  }

  if (input.billData === undefined) {
    return { status: 'loading' }
  }

  if (input.storedSession === null) {
    return { status: 'redirect-join', reason: 'missing-session' }
  }

  const participant = input.billData.participants.find(
    (entry) => entry._id === input.storedSession!.participantId,
  )
  if (!participant) {
    return { status: 'redirect-join', reason: 'participant-not-found' }
  }

  return {
    status: 'ready',
    shareToken: input.shareToken,
    storedSession: input.storedSession,
    participantId: input.storedSession.participantId,
  }
}

export function mapGuestBillToClaimSessionInput(
  data: GuestFlowBillData,
): GuestClaimSessionInputSlice {
  return {
    items: data.items.map((item) => ({
      id: item._id,
      name: item.name,
      quantity: item.quantity,
      sortOrder: item.sortOrder,
      unitPriceCents: item.unitPriceCents,
    })),
    assignments: data.assignments.map((assignment) => ({
      itemId: assignment.itemId,
      participantId: assignment.participantId,
      unitIndex: assignment.unitIndex,
    })),
    participants: data.participants.map((participant) => ({
      id: participant._id,
      sortOrder: participant.sortOrder,
    })),
    billRelations: {
      participants: data.participants,
      items: data.items,
      assignments: data.assignments,
      payments: data.myPayments,
    },
    billContext: {
      tipCents: data.bill.tipCents ?? 0,
      hostParticipantId: data.hostParticipantId,
    },
  }
}

export function planSessionLostRecovery(input: {
  shareToken: string
  storedSession: StoredGuestSessionRef | null
}): FlowRecoveryPlan {
  return {
    clearStorage: true,
    releaseSession: Boolean(input.storedSession && input.shareToken),
    toastMessage: GUEST_FLOW_MESSAGES.sessionLostRedirect,
    redirectShareToken: input.shareToken,
  }
}

export function planIdentitySwitchRecovery(input: {
  shareToken: string
}): FlowRecoveryPlan {
  return {
    clearStorage: true,
    releaseSession: true,
    redirectShareToken: input.shareToken,
  }
}
