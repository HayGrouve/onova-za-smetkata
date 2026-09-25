import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { useState } from 'react'
import { CoveredSeatsPicker } from '#/components/bills/covered-seats-picker.tsx'
import { GuestStepsBar } from '#/components/bills/guest-steps-bar.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { useGuestJoinFlow } from '#/hooks/use-guest-join-flow.ts'
import { ICON } from '#/lib/app-icons.ts'
import {
  buildCoveredSeatCandidates,
  takenSeatLabel,
} from '#/lib/covered-seat-candidates.ts'
import { buildParticipantLabels, joinLabels } from '#/lib/participant-labels.ts'
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
  const [pickedId, setPickedId] = useState<Id<'participants'> | null>(null)
  const [coveredIds, setCoveredIds] = useState<Id<'participants'>[]>([])

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

  const coveredCandidates = pickedId
    ? buildCoveredSeatCandidates({
        participants,
        hostParticipantId,
        ownParticipantId: pickedId,
        takenSeats,
        labels,
      })
    : []

  function handlePick(participantId: Id<'participants'>) {
    const others = buildCoveredSeatCandidates({
      participants,
      hostParticipantId,
      ownParticipantId: participantId,
      takenSeats,
      labels,
    }).filter((candidate) => !candidate.unavailableLabel)
    if (isFinal || others.length === 0) {
      void join(participantId)
      return
    }
    setCoveredIds([])
    setPickedId(participantId)
  }

  const header = (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{dateLabel}</p>
      <h2 className="text-xl font-semibold">{restaurantName}</h2>
    </div>
  )

  if (pickedId) {
    const pickedLabel = labels[pickedId] ?? 'Участник'
    const everyone = [pickedLabel, ...coveredIds.map((id) => labels[id] ?? '')]
    return (
      <div className="page-container flex flex-col gap-6 py-6">
        <GuestStepsBar step={1} />
        {header}
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-medium">
            Здравейте, {pickedLabel}! Плащате ли и за някого?
          </h3>
          <p className="text-sm text-muted-foreground">
            Изберете хората, чиито артикули ще отбелязвате и платите от този
            телефон — например половинката ви. Ако всеки плаща за себе си,
            продължете само за вас.
          </p>
          <CoveredSeatsPicker
            candidates={coveredCandidates}
            selectedIds={coveredIds}
            disabled={joining}
            onToggle={(id) =>
              setCoveredIds((current) =>
                current.includes(id as Id<'participants'>)
                  ? current.filter((entry) => entry !== id)
                  : [...current, id as Id<'participants'>],
              )
            }
          />
          <Button
            type="button"
            className="h-12 text-base"
            disabled={joining}
            onClick={() => void join(pickedId, coveredIds)}
          >
            {coveredIds.length > 0
              ? `Продължи за ${joinLabels(everyone)}`
              : 'Продължи само за мен'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            disabled={joining}
            onClick={() => setPickedId(null)}
          >
            <ArrowLeftIcon className={ICON.button} aria-hidden />
            Не съм {pickedLabel}
          </Button>
        </div>
      </div>
    )
  }

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
              : 'Изберете вашето име. Всяко име може да се използва от един телефон.'}
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
                  onClick={() => handlePick(participant._id)}
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
