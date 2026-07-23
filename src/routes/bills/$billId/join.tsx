import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { GUEST_FLOW_MESSAGES } from '#/lib/guest-flow-messages.ts'
import {
  clearStoredGuestParticipant,
  createGuestSessionToken,
  getConvexErrorMessage,
  getOrCreateGuestDeviceId,
  getStoredGuestSession,
  setStoredGuestSession,
} from '#/lib/guest-participant-session.ts'
import { buildTakenParticipantIds } from '#/lib/join-taken-seats.ts'
import { buildJoinShareHead } from '#/lib/site-meta.ts'
import { joinableParticipants } from '../../../../shared/joinable-participants.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/join')({
  head: ({ params }) => buildJoinShareHead(params.billId),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === 'string' ? search.t : '',
  }),
  component: BillJoinPage,
})

function BillJoinPage() {
  const { billId: billIdParam } = Route.useParams()
  const { t: shareToken } = Route.useSearch()
  const billId = billIdParam as Id<'bills'>

  if (!shareToken) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        {GUEST_FLOW_MESSAGES.invalidJoinLink}
      </div>
    )
  }

  return (
    <QueryErrorBoundary resetKey={`${billId}:${shareToken}`}>
      <BillJoinContent billId={billId} shareToken={shareToken} />
    </QueryErrorBoundary>
  )
}

function BillJoinContent({
  billId,
  shareToken,
}: {
  billId: Id<'bills'>
  shareToken: string
}) {
  const navigate = useNavigate()
  const data = useQuery(api.bills.getForGuest, { billId, shareToken })
  const activeSessions = useQuery(api.guestSessions.listActiveForBill, {
    billId,
    shareToken,
  })
  const claimSession = useMutation(api.guestSessions.claim)
  const [claimingId, setClaimingId] = useState<Id<'participants'> | null>(null)
  const [resuming, setResuming] = useState(true)

  const storedSession = useMemo(
    () => getStoredGuestSession(billId),
    [billId, activeSessions],
  )

  const takenParticipantIds = useMemo(
    () =>
      buildTakenParticipantIds(
        activeSessions,
        storedSession?.participantId,
      ),
    [activeSessions, storedSession?.participantId],
  )

  useEffect(() => {
    if (data === undefined || activeSessions === undefined) return
    const stored = getStoredGuestSession(billId)
    if (!stored || stored.shareToken !== shareToken) {
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

  if (data === undefined || activeSessions === undefined || resuming) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  const { bill, participants, hostParticipantId } = data
  const labels = buildParticipantLabels(participants)
  const sorted = [
    ...joinableParticipants(participants, hostParticipantId),
  ].sort((a, b) => a.sortOrder - b.sortOrder)
  const restaurantName = bill.restaurantName.trim() || 'Сметка'
  const dateLabel = new Intl.DateTimeFormat('bg-BG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(bill.date))
  const isFinal = bill.status === 'final'

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

  return (
    <div className="page-container flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
        <h2 className="text-xl font-semibold">{restaurantName}</h2>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Очаква се домакинът да добави участници.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-medium">Кой сте вие?</h3>
          <p className="text-xs text-muted-foreground">
            {isFinal
              ? 'Сметката е приключена — изберете името си, за да видите разбивката. Всяко име може да се използва от един телефон.'
              : 'Всяко име може да се използва от един телефон. Заетите имена са маркирани по-долу.'}
          </p>
          <div className="flex flex-col gap-2">
            {sorted.map((participant) => {
              const isTaken = takenParticipantIds.has(participant._id)
              const isClaiming = claimingId === participant._id
              const label = labels[participant._id] ?? participant.name
              return (
                <Button
                  key={participant._id}
                  type="button"
                  variant="outline"
                  disabled={isTaken || isClaiming || claimingId !== null}
                  className="h-12 justify-between text-base"
                  aria-label={isTaken ? `${label} — заето` : label}
                  onClick={() => void handlePick(participant._id)}
                >
                  <span>{label}</span>
                  {isTaken ? (
                    <Badge variant="secondary" className="font-normal">
                      Заето
                    </Badge>
                  ) : isClaiming ? (
                    <span className="text-xs text-muted-foreground">...</span>
                  ) : null}
                </Button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
