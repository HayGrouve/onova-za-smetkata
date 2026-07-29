import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  mapGuestBillToClaimSessionInput,
  planIdentitySwitchRecovery,
  planSessionLostRecovery,
  resolveClaimPageGate,
  resolveEffectiveShareToken,
} from '../../shared/guest-flow-session'
import type { FlowRecoveryPlan } from '../../shared/guest-flow-session'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { useGuestClaimSession } from '#/hooks/use-guest-claim-session.ts'
import { useGuestSessionHeartbeat } from '#/hooks/use-guest-session-heartbeat.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import {
  clearStoredGuestParticipant,
  getStoredGuestSession,
} from '#/lib/guest-participant-session.ts'

export function useGuestClaimFlow(
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

  const claimInput = useMemo(
    () => (data ? mapGuestBillToClaimSessionInput(data) : null),
    [data],
  )

  const labels = useMemo(
    () => (data ? buildParticipantLabels(data.participants) : {}),
    [data],
  )

  const claimSession = useGuestClaimSession({
    items: claimInput?.items ?? [],
    assignments: claimInput?.assignments ?? [],
    participantId:
      gate.status === 'ready'
        ? gate.participantId
        : (storedSession?.participantId ?? null),
    billRelations: claimInput?.billRelations,
    billContext: claimInput?.billContext,
    participantLabels: labels,
  })

  const itemDocsById = useMemo(() => {
    const map = new Map<string, Doc<'items'>>()
    if (!data) return map
    for (const item of data.items) {
      map.set(item._id, item)
    }
    return map
  }, [data?.items])

  function handleSwitchIdentity() {
    if (gate.status !== 'ready') return
    executeRecovery(
      planIdentitySwitchRecovery({ shareToken: gate.shareToken }),
      gate.storedSession.sessionToken,
    )
  }

  const readyParticipant =
    gate.status === 'ready' && data
      ? data.participants.find((entry) => entry._id === gate.participantId)
      : undefined

  return {
    gate,
    data,
    pendingCover,
    shareToken,
    storedSession: gate.status === 'ready' ? gate.storedSession : storedSession,
    participantId:
      gate.status === 'ready'
        ? (gate.participantId as Id<'participants'>)
        : null,
    participantLabel: readyParticipant
      ? (labels[readyParticipant._id] ?? readyParticipant.name)
      : null,
    readOnly: data?.bill.status === 'final',
    labels,
    itemDocsById,
    handleSwitchIdentity,
    ...claimSession,
  }
}
