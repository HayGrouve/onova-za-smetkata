import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  buildTakenSeats,
  resolveJoinPageGate,
  shouldAttemptJoinResume,
} from '../../shared/guest-flow-session'
import { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  clearStoredGuestParticipant,
  createGuestSessionToken,
  getConvexErrorData,
  getConvexErrorMessage,
  getOrCreateGuestDeviceId,
  getStoredGuestSession,
  setStoredGuestSession,
} from '#/lib/guest-participant-session.ts'

export function useGuestJoinFlow(billId: Id<'bills'>, shareToken: string) {
  const navigate = useNavigate()
  const data = useQuery(api.bills.getForGuest, { billId, shareToken })
  const activeSeats = useQuery(api.guestSessions.listActiveForBill, {
    billId,
    shareToken,
  })
  const claimSession = useMutation(api.guestSessions.claim)
  const [joining, setJoining] = useState(false)
  const [resuming, setResuming] = useState(() =>
    shouldAttemptJoinResume(getStoredGuestSession(billId), shareToken),
  )
  /**
   * Resume once per visit. The seat list updates as soon as the resume claim
   * lands; re-running then would cancel it and claim again, so every page
   * load used to spend several claims of the per-phone rate limit.
   */
  const resumeStartedRef = useRef(false)
  const unmountedRef = useRef(false)
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])

  const storedSession = useMemo(
    () => getStoredGuestSession(billId),
    [billId, activeSeats],
  )

  const takenSeats = useMemo(
    () => buildTakenSeats(activeSeats, storedSession?.participantId),
    [activeSeats, storedSession?.participantId],
  )

  const gate = resolveJoinPageGate({
    billData: data,
    activeSessions: activeSeats,
    resuming,
  })

  function goToClaim() {
    // Replace: Back from the claim page must not land on join, which would
    // resume and bounce forward again.
    void navigate({
      to: '/bills/$billId/claim',
      params: { billId },
      search: { t: shareToken },
      replace: true,
    })
  }

  useEffect(() => {
    if (data === undefined || activeSeats === undefined) return
    if (resumeStartedRef.current) return
    const stored = getStoredGuestSession(billId)
    if (!stored || !shouldAttemptJoinResume(stored, shareToken)) {
      setResuming(false)
      return
    }
    resumeStartedRef.current = true

    const resume = (coveredParticipantIds: string[] | undefined) =>
      claimSession({
        billId,
        shareToken,
        participantId: stored.participantId as Id<'participants'>,
        sessionToken: stored.sessionToken,
        deviceId: getOrCreateGuestDeviceId(),
        coveredParticipantIds: coveredParticipantIds as
          Id<'participants'>[] | undefined,
      })
    void (async () => {
      try {
        try {
          await resume(stored.coveredParticipantIds)
        } catch (error) {
          if (!stored.coveredParticipantIds?.length || isRateLimit(error)) {
            throw error
          }
          // A Covered seat may be gone or taken meanwhile; keep the own seat.
          await resume([])
          setStoredGuestSession({ ...stored, coveredParticipantIds: undefined })
        }
        if (!unmountedRef.current) goToClaim()
      } catch (error) {
        if (isSeatLost(error)) {
          clearStoredGuestParticipant(billId)
          toast.error(GUEST_FLOW_MESSAGES.sessionLostRedirect)
        } else {
          // A rate limit, a dropped connection, a server hiccup: the seat may
          // still be ours, so keep the session — tapping the seat retries it.
          toast.error(getConvexErrorMessage(error))
        }
        if (!unmountedRef.current) setResuming(false)
      }
    })()
  }, [billId, claimSession, data, activeSeats, navigate, shareToken])

  /**
   * Claim the guest's own seat and open the claim page straight away. Covered
   * seats are added later from the slip on the claim page („Плащам и за...“).
   */
  async function join(participantId: Id<'participants'>) {
    if (takenSeats.has(participantId)) return

    // This phone picking its own seat again keeps its session (and Covered
    // seats); its old session may still hold the seat for a while.
    const stored = getStoredGuestSession(billId)
    const ownSeatAgain =
      stored?.participantId === participantId &&
      stored.shareToken === shareToken
    const sessionToken = ownSeatAgain
      ? stored.sessionToken
      : createGuestSessionToken()
    setJoining(true)
    try {
      await claimSession({
        billId,
        shareToken,
        participantId,
        sessionToken,
        deviceId: getOrCreateGuestDeviceId(),
        coveredParticipantIds: ownSeatAgain ? undefined : [],
      })
      setStoredGuestSession(
        ownSeatAgain
          ? stored
          : { billId, participantId, sessionToken, shareToken },
      )
      goToClaim()
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setJoining(false)
    }
  }

  return {
    gate,
    data,
    takenSeats,
    joining,
    join,
  }
}

function isRateLimit(error: unknown): boolean {
  const message = getConvexErrorMessage(error)
  return (
    message === GUEST_FLOW_MESSAGES.claimRateLimitActor ||
    message === GUEST_FLOW_MESSAGES.claimRateLimitBill
  )
}

/** Answers that mean this phone's stored seat is gone for good. */
const SEAT_LOST_REASONS = new Set<string>([
  GUEST_FLOW_MESSAGES.nameTaken,
  GUEST_FLOW_MESSAGES.participantNotOnBill,
  GUEST_FLOW_MESSAGES.hostSeatNotJoinable,
  GUEST_FLOW_MESSAGES.sessionRequired,
  GUEST_FLOW_MESSAGES.invalidShareLink,
  GUEST_FLOW_MESSAGES.billNotFound,
])

function isSeatLost(error: unknown): boolean {
  const reason = getConvexErrorData(error)
  return reason !== null && SEAT_LOST_REASONS.has(reason)
}
