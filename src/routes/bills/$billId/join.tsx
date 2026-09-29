import { createFileRoute } from '@tanstack/react-router'
import { GuestStepsBar } from '#/components/bills/guest-steps-bar.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { useGuestJoinFlow } from '#/hooks/use-guest-join-flow.ts'
import { takenSeatLabel } from '#/lib/covered-seat-candidates.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { GUEST_FLOW_MESSAGES } from '../../../../shared/guest-flow-messages.ts'
import { buildJoinShareHead } from '#/lib/site-meta.ts'
import { joinableParticipants } from '../../../../shared/joinable-participants.ts'
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
  const { gate, data, takenSeats, joining, join } = useGuestJoinFlow(
    billId,
    shareToken,
  )

  if (gate === 'loading' || !data) {
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

  const header = (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{dateLabel}</p>
      <h2 className="text-xl font-semibold">{restaurantName}</h2>
    </div>
  )

  return (
    <div className="page-container flex flex-col gap-6 py-6">
      <GuestStepsBar step={1} />
      {header}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Очаква се домакинът да добави участници.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-medium">Кой сте вие?</h3>
          <p className="text-xs text-muted-foreground">
            {isFinal
              ? 'Сметката е приключена — изберете името си, за да видите разбивката.'
              : 'Докоснете името си и веднага отбелязвайте. Всяко име е за един телефон — ако плащате и за някого, ще го добавите на следващия екран.'}
          </p>
          <div className="flex flex-col gap-2">
            {sorted.map((participant) => {
              const isTaken = takenSeats.has(participant._id)
              const label = labels[participant._id] ?? participant.name
              const takenLabel = isTaken
                ? takenSeatLabel(
                    takenSeats.get(participant._id) ?? null,
                    labels,
                  )
                : null
              return (
                <Button
                  key={participant._id}
                  type="button"
                  variant="outline"
                  disabled={isTaken || joining}
                  className="h-12 justify-between text-base"
                  aria-label={takenLabel ? `${label} — ${takenLabel}` : label}
                  onClick={() => void join(participant._id)}
                >
                  <span>{label}</span>
                  {takenLabel ? (
                    <Badge variant="secondary" className="font-normal">
                      {takenLabel}
                    </Badge>
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
