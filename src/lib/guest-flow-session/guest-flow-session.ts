import {
  getConvexErrorData,
  getConvexErrorMessage,
} from '#/lib/convex-error.ts'
import { GUEST_FLOW_MESSAGES } from '../../../shared/guest-flow-messages.ts'

/** What a phone remembers about its Guest session between visits. */
export type StoredGuestSession = {
  billId: string
  participantId: string
  sessionToken: string
  shareToken: string
  /** Covered seats — re-sent when the phone resumes its seat. */
  coveredParticipantIds?: string[]
}

/** Where this phone keeps its Guest session (localStorage in the app). */
export interface SeatStore {
  read: (billId: string) => StoredGuestSession | null
  write: (session: StoredGuestSession) => void
  clear: (billId: string) => void
}

/** The server calls the Guest journey makes (Convex in the app). */
export interface SeatServer {
  /** Take a seat; `coveredParticipantIds` undefined keeps the Covered seats as they are. */
  claim: (args: {
    billId: string
    shareToken: string
    participantId: string
    sessionToken: string
    deviceId: string
    coveredParticipantIds?: string[]
  }) => Promise<unknown>
  release: (args: { billId: string; sessionToken: string }) => Promise<unknown>
}

/** Where the Guest goes next, and what to tell them. */
export type FlowOutcome =
  | { to: 'claim' }
  | { to: 'picker'; message: string }
  | { to: 'join'; shareToken: string; message?: string }

/** Answers that mean this phone's stored seat is gone for good. */
const SEAT_LOST_REASONS = new Set<string>([
  GUEST_FLOW_MESSAGES.nameTaken,
  GUEST_FLOW_MESSAGES.participantNotOnBill,
  GUEST_FLOW_MESSAGES.hostSeatNotJoinable,
  GUEST_FLOW_MESSAGES.sessionRequired,
  GUEST_FLOW_MESSAGES.invalidShareLink,
  GUEST_FLOW_MESSAGES.billNotFound,
])

const RATE_LIMITS = new Set<string>([
  GUEST_FLOW_MESSAGES.claimRateLimitActor,
  GUEST_FLOW_MESSAGES.claimRateLimitBill,
])

/**
 * Why a seat claim failed: the seat is gone for good, the phone is rate
 * limited, or something passing (network, server) that a retry may fix.
 */
export function classifyClaimFailure(
  error: unknown,
): 'seat-lost' | 'rate-limited' | 'passing' {
  if (RATE_LIMITS.has(getConvexErrorMessage(error))) return 'rate-limited'
  const reason = getConvexErrorData(error)
  if (reason !== null && SEAT_LOST_REASONS.has(reason)) return 'seat-lost'
  return 'passing'
}

/** The join page may resume this phone's seat: it holds one for this link. */
export function canResume(
  session: StoredGuestSession | null,
  shareToken: string,
): boolean {
  return session !== null && session.shareToken === shareToken
}

export type ClaimPageGate =
  | { status: 'loading' }
  | {
      status: 'leave'
      reason: 'missing-link' | 'missing-session' | 'seat-removed'
    }
  | {
      status: 'ready'
      shareToken: string
      session: StoredGuestSession
      participantId: string
    }

/**
 * Where a claim or pay page stands. The stored link wins over the URL's, so a
 * phone keeps the link it joined with.
 */
export function claimPageGate(input: {
  session: StoredGuestSession | null
  shareTokenFromUrl: string
  billData: { participants: Array<{ _id: string }> } | undefined
}): ClaimPageGate {
  const shareToken = input.session?.shareToken ?? input.shareTokenFromUrl
  if (!shareToken) return { status: 'leave', reason: 'missing-link' }
  if (input.billData === undefined) return { status: 'loading' }
  if (input.session === null) {
    return { status: 'leave', reason: 'missing-session' }
  }
  const { participantId } = input.session
  if (!input.billData.participants.some((p) => p._id === participantId)) {
    return { status: 'leave', reason: 'seat-removed' }
  }
  return { status: 'ready', shareToken, session: input.session, participantId }
}

export type ActiveGuestSeat = {
  participantId: string
  /** Set when the seat is a Covered seat — the holder's own seat. */
  heldByParticipantId?: string
}

/**
 * Seats other phones hold (this phone's own seats excluded). The value is the
 * holder's own seat for a Covered seat, `null` for someone's own seat.
 */
export function takenSeats(
  activeSeats: ActiveGuestSeat[] | undefined,
  ownParticipantId: string | undefined,
): Map<string, string | null> {
  const taken = new Map<string, string | null>()
  for (const seat of activeSeats ?? []) {
    const holder = seat.heldByParticipantId ?? seat.participantId
    if (ownParticipantId !== undefined && holder === ownParticipantId) continue
    taken.set(seat.participantId, seat.heldByParticipantId ?? null)
  }
  return taken
}

/** Seats this phone handles, own seat first, that are still on the bill. */
export function mySeatIds(
  data: { mySeatIds?: string[]; participants: Array<{ _id: string }> },
  ownParticipantId: string,
): string[] {
  const onBill = new Set(data.participants.map((p) => p._id))
  const seats = [ownParticipantId, ...(data.mySeatIds ?? [])]
  return [...new Set(seats)].filter((id) => onBill.has(id))
}

/**
 * The Guest journey for one bill on this phone: resume or pick a seat on the
 * join page, recover when the claim or pay page loses its session, switch to
 * another seat. Every intent returns where the Guest goes next; the caller
 * navigates and shows the message.
 */
export function createGuestFlowSession(deps: {
  billId: string
  store: SeatStore
  server: SeatServer
  newSessionToken: () => string
  deviceId: () => string
}) {
  const { billId, store, server } = deps

  return {
    /**
     * The join page opened with `shareToken`: take this phone's stored seat
     * again, silently. Null when there is nothing to resume.
     */
    async resume(shareToken: string): Promise<FlowOutcome | null> {
      const stored = store.read(billId)
      if (!stored || !canResume(stored, shareToken)) return null
      const claim = (coveredParticipantIds: string[] | undefined) =>
        server.claim({
          billId,
          shareToken,
          participantId: stored.participantId,
          sessionToken: stored.sessionToken,
          deviceId: deps.deviceId(),
          coveredParticipantIds,
        })

      try {
        try {
          await claim(stored.coveredParticipantIds)
        } catch (error) {
          if (
            !stored.coveredParticipantIds?.length ||
            classifyClaimFailure(error) === 'rate-limited'
          ) {
            throw error
          }
          // A Covered seat may be gone or taken meanwhile; keep the own seat.
          await claim([])
          store.write({ ...stored, coveredParticipantIds: undefined })
        }
        return { to: 'claim' }
      } catch (error) {
        if (classifyClaimFailure(error) === 'seat-lost') {
          store.clear(billId)
          return {
            to: 'picker',
            message: GUEST_FLOW_MESSAGES.sessionLostRedirect,
          }
        }
        // A rate limit, a dropped connection, a server hiccup: the seat may
        // still be ours, so keep the session — tapping the seat retries it.
        return { to: 'picker', message: getConvexErrorMessage(error) }
      }
    },

    /**
     * The Guest picks their own seat on the join page; Covered seats are added
     * later from the Slip. Picking this phone's seat again keeps its session
     * and Covered seats — its old session may still hold the seat for a while.
     */
    async pickSeat(
      shareToken: string,
      participantId: string,
    ): Promise<FlowOutcome> {
      const stored = store.read(billId)
      const ownSeatAgain =
        stored !== null &&
        stored.participantId === participantId &&
        stored.shareToken === shareToken
      const sessionToken = ownSeatAgain
        ? stored.sessionToken
        : deps.newSessionToken()
      try {
        await server.claim({
          billId,
          shareToken,
          participantId,
          sessionToken,
          deviceId: deps.deviceId(),
          coveredParticipantIds: ownSeatAgain ? undefined : [],
        })
      } catch (error) {
        return { to: 'picker', message: getConvexErrorMessage(error) }
      }
      if (!ownSeatAgain) {
        store.write({ billId, participantId, sessionToken, shareToken })
      }
      return { to: 'claim' }
    },

    /** The Covered seats changed on the claim page; resume with these. */
    rememberCoveredSeats(coveredParticipantIds: string[]): void {
      const stored = store.read(billId)
      if (stored) store.write({ ...stored, coveredParticipantIds })
    },

    /**
     * The claim or pay page cannot stay. A lost seat says so; a missing
     * session just goes to the join page, which resumes or offers the picker.
     */
    leaveClaimPage(
      reason: 'missing-link' | 'missing-session' | 'seat-removed',
      shareToken: string,
    ): FlowOutcome {
      if (reason === 'missing-link') return { to: 'join', shareToken: '' }
      if (reason === 'seat-removed') {
        store.clear(billId)
        return {
          to: 'join',
          shareToken,
          message: GUEST_FLOW_MESSAGES.seatRemoved,
        }
      }
      return { to: 'join', shareToken }
    },

    /**
     * The session lapsed (the phone slept past the TTL, the link changed, the
     * seat went away). The join page resumes the same seat silently when it
     * is still free, and only falls back to the picker when it is not.
     */
    sessionLost(shareToken: string): FlowOutcome {
      return { to: 'join', shareToken }
    },

    /** „Не съм …“: give the seat back and pick again. */
    switchIdentity(session: StoredGuestSession): FlowOutcome {
      // Best effort: the phone may be offline; the TTL frees the seat anyway.
      server
        .release({ billId, sessionToken: session.sessionToken })
        .catch(() => undefined)
      store.clear(billId)
      return { to: 'join', shareToken: session.shareToken }
    },
  }
}

export type GuestFlowSession = ReturnType<typeof createGuestFlowSession>
