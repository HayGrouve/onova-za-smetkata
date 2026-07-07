import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import {
  getStoredGuestParticipant,
  setStoredGuestParticipant,
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
  const data = useQuery(api.bills.get, { billId })

  useEffect(() => {
    const stored = getStoredGuestParticipant(billId)
    if (stored) {
      void navigate({ to: '/bills/$billId/claim', params: { billId } })
    }
  }, [billId, navigate])

  if (data === undefined) {
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

  function handlePick(participantId: Id<'participants'>) {
    setStoredGuestParticipant(billId, participantId)
    void navigate({ to: '/bills/$billId/claim', params: { billId } })
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
          <Button
            className="h-11"
            onClick={() =>
              void navigate({ to: '/bills/$billId/claim', params: { billId } })
            }
          >
            Виж моя дял
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Очаква се домакинът да добави участници.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-medium">Кой сте вие?</h3>
          <div className="flex flex-col gap-2">
            {sorted.map((participant) => (
              <Button
                key={participant._id}
                type="button"
                variant="outline"
                className="h-12 justify-start text-base"
                onClick={() => handlePick(participant._id)}
              >
                {labels[participant._id] ?? participant.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
