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
  /** After a rate limit, stop resuming on every seat update; a tap retries. */
  const resumeRateLimitedRef = useRef(false)

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
    if (
      resumeRateLimitedRef.current ||
      !shouldAttemptJoinResume(getStoredGuestSession(billId), shareToken)
    ) {
      setResuming(false)
      return
    }

    const stored = getStoredGuestSession(billId)
    if (!stored) {
      setResuming(false)
      return
    }

    const cancelledRef = { current: false }
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
        if (cancelledRef.current) return
        goToClaim()
      } catch (error) {
        if (isRateLimit(error)) {
          // Not a lost seat: keep the stored session; tapping the seat retries.
          resumeRateLimitedRef.current = true
          toast.error(getConvexErrorMessage(error))
        } else {
          clearStoredGuestParticipant(billId)
          toast.error(GUEST_FLOW_MESSAGES.sessionLostRedirect)
        }
        if (!cancelledRef.current) setResuming(false)
      }
    })()

    return () => {
      cancelledRef.current = true
    }
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
