import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  buildTakenParticipantIds,
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
  const activeSessions = useQuery(api.guestSessions.listActiveForBill, {
    billId,
    shareToken,
  })
  const claimSession = useMutation(api.guestSessions.claim)
  const [claimingId, setClaimingId] = useState<Id<'participants'> | null>(null)
  const [resuming, setResuming] = useState(() =>
    shouldAttemptJoinResume(getStoredGuestSession(billId), shareToken),
  )

  const storedSession = useMemo(
    () => getStoredGuestSession(billId),
    [billId, activeSessions],
  )

  const takenParticipantIds = useMemo(
    () =>
      buildTakenParticipantIds(activeSessions, storedSession?.participantId),
    [activeSessions, storedSession?.participantId],
  )

  const gate = resolveJoinPageGate({
    billData: data,
    activeSessions,
    resuming,
  })

  useEffect(() => {
    if (data === undefined || activeSessions === undefined) return
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
        })
        if (cancelledRef.current) return
        void navigate({
          to: '/bills/$billId/claim',
          params: { billId },
          search: { t: shareToken },
        })
      } catch {
        clearStoredGuestParticipant(billId)
        if (!cancelledRef.current) setResuming(false)
      }
    })()

    return () => {
      cancelledRef.current = true
    }
  }, [billId, claimSession, data, activeSessions, navigate, shareToken])

  async function handlePick(participantId: Id<'participants'>) {
    if (takenParticipantIds.has(participantId)) return

    const sessionToken = createGuestSessionToken()
    setClaimingId(participantId)
    try {
      await claimSession({
        billId,
        shareToken,
        participantId,
        sessionToken,
        deviceId: getOrCreateGuestDeviceId(),
      })
      setStoredGuestSession({
        billId,
        participantId,
        sessionToken,
        shareToken,
      })
      void navigate({
        to: '/bills/$billId/claim',
        params: { billId },
        search: { t: shareToken },
      })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setClaimingId(null)
    }
  }

  return {
    gate,
    data,
    takenParticipantIds,
    claimingId,
    handlePick,
  }
}
