import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  buildTakenSeats,
  resolveJoinPageGate,
  shouldAttemptJoinResume,
} from '../../shared/guest-flow-session'
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
    void navigate({
      to: '/bills/$billId/claim',
      params: { billId },
      search: { t: shareToken },
    })
  }

  useEffect(() => {
    if (data === undefined || activeSeats === undefined) return
    if (!shouldAttemptJoinResume(getStoredGuestSession(billId), shareToken)) {
      setResuming(false)
      return
    }

    const stored = getStoredGuestSession(billId)
    if (!stored) {
      setResuming(false)
      return
    }

    const cancelledRef = { current: false }
    void (async () => {
      try {
        await claimSession({
          billId,
          shareToken,
          participantId: stored.participantId as Id<'participants'>,
          sessionToken: stored.sessionToken,
          deviceId: getOrCreateGuestDeviceId(),
          coveredParticipantIds: stored.coveredParticipantIds as
            Id<'participants'>[] | undefined,
        })
        if (cancelledRef.current) return
        goToClaim()
      } catch {
        clearStoredGuestParticipant(billId)
        if (!cancelledRef.current) setResuming(false)
      }
    })()

    return () => {
      cancelledRef.current = true
    }
  }, [billId, claimSession, data, activeSeats, navigate, shareToken])

  /** Claim the guest's own seat plus any Covered seats, then open the claim page. */
  async function join(
    participantId: Id<'participants'>,
    coveredParticipantIds: Id<'participants'>[] = [],
  ) {
    if (takenSeats.has(participantId)) return

    const sessionToken = createGuestSessionToken()
    setJoining(true)
    try {
      await claimSession({
        billId,
        shareToken,
        participantId,
        sessionToken,
        deviceId: getOrCreateGuestDeviceId(),
        coveredParticipantIds,
      })
      setStoredGuestSession({
        billId,
        participantId,
        sessionToken,
        shareToken,
        ...(coveredParticipantIds.length > 0 ? { coveredParticipantIds } : {}),
      })
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
