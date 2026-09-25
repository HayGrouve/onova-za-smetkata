import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  planIdentitySwitchRecovery,
  planSessionLostRecovery,
  resolveClaimPageGate,
  resolveEffectiveShareToken,
  resolveMySeatIds,
} from '../../shared/guest-flow-session'
import type { FlowRecoveryPlan } from '../../shared/guest-flow-session'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useGuestSessionHeartbeat } from '#/hooks/use-guest-session-heartbeat.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import {
  clearStoredGuestParticipant,
  getStoredGuestSession,
} from '#/lib/guest-participant-session.ts'

/**
 * Guest flow session for the claim and pay pages: loads the bill for the stored
 * guest session, keeps it alive, and sends the guest back to join when it is lost.
 */
export function useGuestBillSession(
  billId: Id<'bills'>,
  shareTokenFromUrl: string,
) {
  const navigate = useNavigate()

  const storedSession = useMemo(() => getStoredGuestSession(billId), [billId])
  const shareToken = resolveEffectiveShareToken(
    storedSession,
    shareTokenFromUrl,
  )

  const data = useQuery(
    api.bills.getForGuest,
    shareToken
      ? {
          billId,
          shareToken,
          sessionToken: storedSession?.sessionToken,
        }
      : 'skip',
  )
  const pendingCover = useQuery(
    api.combinedPayments.getPendingCoverForGuest,
    shareToken && storedSession
      ? {
          billId,
          shareToken,
          sessionToken: storedSession.sessionToken,
        }
      : 'skip',
  )
  const releaseSession = useMutation(api.guestSessions.release)

  const redirectToJoin = useCallback(
    (token: string) => {
      void navigate({
        to: '/bills/$billId/join',
        params: { billId },
        search: { t: token },
      })
    },
    [billId, navigate],
  )

  const executeRecovery = useCallback(
    (plan: FlowRecoveryPlan, sessionToken?: string) => {
      if (plan.releaseSession && sessionToken && plan.redirectShareToken) {
        void releaseSession({
          billId,
          shareToken: plan.redirectShareToken,
          sessionToken,
        })
      }
      clearStoredGuestParticipant(billId)
      if (plan.toastMessage) {
        toast.error(plan.toastMessage)
      }
      redirectToJoin(plan.redirectShareToken)
    },
    [billId, redirectToJoin, releaseSession],
  )

  const handleSessionLost = useCallback(() => {
    executeRecovery(
      planSessionLostRecovery({
        shareToken,
        storedSession,
      }),
      storedSession?.sessionToken,
    )
  }, [executeRecovery, shareToken, storedSession])

  useGuestSessionHeartbeat(
    data?.bill.status === 'final' ? null : storedSession,
    handleSessionLost,
  )

  const gate = resolveClaimPageGate({
    shareToken,
    storedSession,
    billData: data,
  })

  useEffect(() => {
    if (gate.status === 'redirect-join' && gate.reason === 'missing-token') {
      redirectToJoin('')
      return
    }
    if (gate.status === 'redirect-join' && gate.reason === 'missing-session') {
      redirectToJoin(shareToken)
      return
    }
    if (
      gate.status === 'redirect-join' &&
      gate.reason === 'participant-not-found'
    ) {
      clearStoredGuestParticipant(billId)
      redirectToJoin(shareToken)
    }
  }, [billId, gate, redirectToJoin, shareToken])

  const labels = useMemo(
    () => (data ? buildParticipantLabels(data.participants) : {}),
    [data],
  )

  const participantId =
    gate.status === 'ready' ? (gate.participantId as Id<'participants'>) : null

  const mySeatIds = useMemo(
    () =>
      data && participantId
        ? (resolveMySeatIds(data, participantId) as Id<'participants'>[])
        : [],
    [data, participantId],
  )

  function handleSwitchIdentity() {
    if (gate.status !== 'ready') return
    executeRecovery(
      planIdentitySwitchRecovery({ shareToken: gate.shareToken }),
      gate.storedSession.sessionToken,
    )
  }

  return {
    gate,
    data,
    pendingCover,
    shareToken,
    storedSession: gate.status === 'ready' ? gate.storedSession : storedSession,
    participantId,
    mySeatIds,
    readOnly: data?.bill.status === 'final',
    labels,
    handleSwitchIdentity,
  }
}
