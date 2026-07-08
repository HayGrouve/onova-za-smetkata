import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import {
  clearStoredGuestParticipant,
  createGuestSessionToken,
  getConvexErrorMessage,
  getStoredGuestSession,
  setStoredGuestSession,
} from '#/lib/guest-participant-session.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/join')({
  component: BillJoinPage,
})

function BillJoinPage() {
  const { billId: billIdParam } = Route.useParams()
  const billId = billIdParam as Id<'bills'>
  const navigate = useNavigate()
  const data = useQuery(api.bills.getForGuest, { billId })
  const activeSessions = useQuery(api.guestSessions.listActiveForBill, { billId })
  const claimSession = useMutation(api.guestSessions.claim)
  const [claimingId, setClaimingId] = useState<Id<'participants'> | null>(null)
  const [resuming, setResuming] = useState(true)

  const storedSession = useMemo(
    () => getStoredGuestSession(billId),
    [billId, activeSessions],
  )

  const takenParticipantIds = useMemo(() => {
    if (!activeSessions) return new Set<string>()
    const ownId = storedSession?.participantId
    return new Set(
      activeSessions
        .filter((session) => session.participantId !== ownId)
        .map((session) => session.participantId),
    )
  }, [activeSessions, storedSession?.participantId])

  useEffect(() => {
    if (data === undefined || activeSessions === undefined) return
    const stored = getStoredGuestSession(billId)
    if (!stored) {
      setResuming(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        await claimSession({
          billId,
          participantId: stored.participantId as Id<'participants'>,
          sessionToken: stored.sessionToken,
        })
        if (!cancelled) {
          void navigate({ to: '/bills/$billId/claim', params: { billId } })
        }
      } catch {
        clearStoredGuestParticipant(billId)
        if (!cancelled) setResuming(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [billId, claimSession, data, activeSessions, navigate])

  if (data === undefined || activeSessions === undefined || resuming) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  if (data === null) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Сметката не е намерена.
      </div>
    )
  }

  const { bill, participants } = data
  const labels = buildParticipantLabels(participants)
  const sorted = [...participants].sort((a, b) => a.sortOrder - b.sortOrder)
  const restaurantName = bill.restaurantName.trim() || 'Сметка'
  const dateLabel = new Intl.DateTimeFormat('bg-BG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(bill.date))

  async function handlePick(participantId: Id<'participants'>) {
    if (takenParticipantIds.has(participantId)) return

    const sessionToken = createGuestSessionToken()
    setClaimingId(participantId)
    try {
      await claimSession({ billId, participantId, sessionToken })
      setStoredGuestSession({ billId, participantId, sessionToken })
      void navigate({ to: '/bills/$billId/claim', params: { billId } })
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

      {bill.status === 'final' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Сметката е приключена.</p>
          <p className="text-xs text-muted-foreground">
            Изберете името си, за да видите разбивката.
          </p>
          <div className="flex flex-col gap-2">
            {sorted.map((participant) => {
              const label = labels[participant._id] ?? participant.name
              return (
                <Button
                  key={participant._id}
                  type="button"
                  variant="outline"
                  className="h-12 justify-start text-base"
                  disabled={claimingId !== null}
                  onClick={() => void handlePick(participant._id)}
                >
                  {label}
                </Button>
              )
            })}
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Очаква се домакинът да добави участници.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-medium">Кой сте вие?</h3>
          <p className="text-xs text-muted-foreground">
            Всяко име може да се използва от един телефон. Заетите имена са
            маркирани по-долу.
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
