import type {
  BillCalculationContext,
  LoadedBillRelations,
} from './bill-calculation-snapshot'
import type { GuestItemAssignment } from './guest-claim-items'
import type { GuestClaimSessionItem } from './guest-claim-session'
import { GUEST_FLOW_MESSAGES } from './guest-flow-messages'

export type StoredGuestSessionRef = {
  billId: string
  participantId: string
  sessionToken: string
  shareToken: string
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
}

export type GuestClaimSessionInputSlice = {
  items: GuestClaimSessionItem[]
  assignments: GuestItemAssignment[]
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

/** Participant ids taken by other active guest sessions (excludes the viewer's own seat). */
export function buildTakenParticipantIds(
  activeSessions: { participantId: string }[] | undefined,
  ownParticipantId: string | undefined,
): Set<string> {
  if (!activeSessions) return new Set<string>()
  return new Set(
    activeSessions
      .filter((session) => session.participantId !== ownParticipantId)
      .map((session) => session.participantId),
  )
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
    })),
    assignments: data.assignments.map((assignment) => ({
      itemId: assignment.itemId,
      participantId: assignment.participantId,
      unitIndex: assignment.unitIndex,
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
