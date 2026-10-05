import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useGuestSessionHeartbeat } from '#/hooks/use-guest-session-heartbeat.ts'
import {
  claimPageGate,
  mySeatIds as resolveMySeatIds,
} from '#/lib/guest-flow-session/guest-flow-session.ts'
import type { FlowOutcome } from '#/lib/guest-flow-session/guest-flow-session.ts'
import { localSeatStore } from '#/lib/guest-flow-session/local-seat-store.ts'
import { useGuestFlowSession } from '#/lib/guest-flow-session/use-guest-flow-session.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'

/**
 * Guest flow session for the claim and pay pages: loads the bill for the stored
 * guest session, keeps it alive, and sends the guest back to join when it is lost.
 */
export function useGuestBillSession(
  billId: Id<'bills'>,
  shareTokenFromUrl: string,
) {
  const navigate = useNavigate()
  const flow = useGuestFlowSession(billId)

  const storedSession = useMemo(() => localSeatStore.read(billId), [billId])
  const shareToken = storedSession?.shareToken ?? shareTokenFromUrl

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
    storedSession
      ? { billId, sessionToken: storedSession.sessionToken }
      : 'skip',
  )

  const follow = useCallback(
    (outcome: FlowOutcome) => {
      if (outcome.to !== 'join') return
      if (outcome.message) toast.error(outcome.message)
      void navigate({
        to: '/bills/$billId/join',
        params: { billId },
        search: { t: outcome.shareToken },
      })
    },
    [billId, navigate],
  )

  const handleSessionLost = useCallback(() => {
    follow(flow.sessionLost(shareToken))
  }, [flow, follow, shareToken])

  useGuestSessionHeartbeat(
    data?.bill.status === 'final' ? null : storedSession,
    handleSessionLost,
  )

  const gate = claimPageGate({
    session: storedSession,
    shareTokenFromUrl,
    billData: data,
  })
  const leaveReason = gate.status === 'leave' ? gate.reason : null

  useEffect(() => {
    if (leaveReason) follow(flow.leaveClaimPage(leaveReason, shareToken))
  }, [flow, follow, leaveReason, shareToken])

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
    follow(flow.switchIdentity(gate.session))
  }

  return {
    gate,
    data,
    pendingCover,
    shareToken,
    storedSession: gate.status === 'ready' ? gate.session : storedSession,
    participantId,
    mySeatIds,
    readOnly: data?.bill.status === 'final',
    labels,
    handleSwitchIdentity,
  }
}
