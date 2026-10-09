import { createFileRoute } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { withReducedMotion } from '#/components/motion-root.tsx'
import { BillHeaderSlot } from '#/components/layout/bill-header-title.tsx'
import { ClaimLine } from '#/components/receipt/claim-line.tsx'
import {
  Receipt,
  ReceiptHeader,
  RestaurantTitle,
  Rule,
} from '#/components/receipt/paper.tsx'
import {
  ReceiptLoading,
  ReceiptMessage,
} from '#/components/receipt/receipt-states.tsx'
import {
  SeatAvatar,
  SeatsProvider,
  useSeatLookup,
} from '#/components/receipt/seats.tsx'
import { Timeline } from '#/components/receipt/timeline.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { useGuestJoinFlow } from '#/hooks/use-guest-join-flow.ts'
import { takenSeatLabel } from '#/lib/covered-seat-candidates.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { cn } from '#/lib/utils.ts'
import {
  groupClaimItems,
  indexUnitMembers,
  unitKey,
} from '../../../../shared/claim-groups.ts'
import { GUEST_FLOW_MESSAGES } from '../../../../shared/guest-flow-messages.ts'
import { buildJoinShareHead } from '#/lib/site-meta.ts'
import { joinableParticipants } from '../../../../shared/joinable-participants.ts'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/join')({
  head: ({ params }) => buildJoinShareHead(params.billId),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === 'string' ? search.t : '',
  }),
  component: withReducedMotion(BillJoinPage),
})

function BillJoinPage() {
  const { billId: billIdParam } = Route.useParams()
  const { t: shareToken } = Route.useSearch()
  const billId = billIdParam as Id<'bills'>

  if (!shareToken) {
    return (
      <ReceiptMessage>{GUEST_FLOW_MESSAGES.invalidJoinLink}</ReceiptMessage>
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
    return <ReceiptLoading />
  }

  const { bill, participants, hostParticipantId } = data
  const labels = buildParticipantLabels(participants)
  const joinable = [
    ...joinableParticipants(participants, hostParticipantId),
  ].sort((a, b) => a.sortOrder - b.sortOrder)
  const hostName = hostParticipantId
    ? (labels[hostParticipantId] ?? 'Домакинът')
    : 'Домакинът'
  const isFinal = bill.status === 'final'
  const groups = groupClaimItems(
    data.items.map((item) => ({
      id: item._id,
      name: item.name,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      sortOrder: item.sortOrder,
    })),
  )
  const membersByUnit = indexUnitMembers(data.assignments)

  return (
    <SeatsProvider
      participants={participants}
      hostParticipantId={hostParticipantId}
    >
      <BillHeaderSlot>
        <Timeline phase={isFinal ? 'settle' : 'table'} final={isFinal} />
      </BillHeaderSlot>
      <div className="mx-auto w-full max-w-[480px] px-3 pt-4 pb-24 sm:pt-10">
        <Receipt>
          <ReceiptHeader
            date={bill.date}
            right={`Маса на ${hostName}`}
            title={<RestaurantTitle name={bill.restaurantName} />}
          >
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              {isFinal
                ? 'Сметката е приключена. Изберете името си, за да видите разбивката.'
                : `${hostName} плати сметката. Изберете кой сте и отбележете какво сте яли и пили.`}
            </p>
          </ReceiptHeader>
          <Rule />
          <section aria-labelledby="join-who">
            <h2 id="join-who" className="font-display text-[20px] font-bold">
              Кой сте вие?
            </h2>
            {joinable.length === 0 ? (
              <p className="mt-3 text-[12px] leading-relaxed">
                {hostName} още не е добавил хората на масата. Страницата ще се
                обнови сама.
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-3 gap-2">
                {joinable.map((participant) => (
                  <JoinSeatTile
                    key={participant._id}
                    participantId={participant._id}
                    takenLabel={
                      takenSeats.has(participant._id)
                        ? takenSeatLabel(
                            takenSeats.get(participant._id) ?? null,
                            labels,
                          )
                        : null
                    }
                    disabled={joining}
                    onPick={() => void join(participant._id)}
                  />
                ))}
                <NotListedTile hostName={hostName} />
              </ul>
            )}
            {!isFinal && joinable.length > 0 ? (
              <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
                Всяко име е за един телефон. Ако плащате и за някого, ще го
                добавите на следващия екран.
              </p>
            ) : null}
          </section>
          {groups.length > 0 ? (
            <>
              <Rule />
              <div
                aria-hidden
                className="pointer-events-none opacity-45 select-none"
              >
                <ul>
                  {groups.slice(0, 5).map((group) => (
                    <ClaimLine
                      key={group.key}
                      group={group}
                      mode="readonly"
                      membersOf={(unit) =>
                        membersByUnit.get(unitKey(unit)) ?? []
                      }
                    />
                  ))}
                </ul>
                {groups.length > 5 ? (
                  <p className="pt-1 text-center text-[11px]">
                    и още {groups.length - 5} реда
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </Receipt>
      </div>
    </SeatsProvider>
  )
}

function JoinSeatTile({
  participantId,
  takenLabel,
  disabled,
  onPick,
}: {
  participantId: string
  takenLabel: string | null
  disabled: boolean
  onPick: () => void
}) {
  const seat = useSeatLookup()(participantId)
  if (!seat) return null
  const taken = takenLabel !== null
  return (
    <li>
      <button
        type="button"
        disabled={taken || disabled}
        onClick={onPick}
        className={cn(
          'flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 py-2 transition-colors',
          taken
            ? 'border-transparent'
            : 'border-ink hover:bg-paper-2 active:scale-[0.98]',
        )}
        aria-label={taken ? `${seat.label}, ${takenLabel}` : seat.label}
      >
        <SeatAvatar
          seat={seat}
          size="lg"
          className={cn(taken && 'opacity-40 grayscale')}
        />
        <span
          className={cn(
            'max-w-full truncate px-1 text-[13px] font-semibold',
            taken && 'text-ink-muted',
          )}
        >
          {seat.label}
        </span>
        {takenLabel ? (
          <span className="max-w-full truncate px-1 text-[10px] tracking-wide text-ink-muted uppercase">
            {takenLabel}
          </span>
        ) : null}
      </button>
    </li>
  )
}

/** Guests cannot add themselves; the list updates live once the host does. */
function NotListedTile({ hostName }: { hostName: string }) {
  const [open, setOpen] = useState(false)
  return (
    <li className={cn(open && 'col-span-3')}>
      {open ? (
        <div className="border-l-[3px] border-ink bg-paper-2 p-3 text-[12px] leading-relaxed">
          <p className="font-semibold">Няма ви в списъка?</p>
          <p className="mt-1">
            Помолете {hostName} да ви добави. Името ви ще се появи тук само, без
            да презареждате.
          </p>
          <button
            type="button"
            className="mt-1 min-h-11 underline decoration-dotted decoration-2 underline-offset-4"
            onClick={() => setOpen(false)}
          >
            Разбрах
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-ink-muted px-1 py-2 hover:border-solid hover:border-ink"
        >
          <span className="grid size-14 place-items-center rounded-full border-2 border-dashed border-current">
            <PlusIcon className="size-6" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-[13px] font-semibold">Няма ме</span>
        </button>
      )}
    </li>
  )
}
