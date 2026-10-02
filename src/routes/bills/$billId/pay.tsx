import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useMemo } from 'react'
import { GuestPayView } from '#/components/guest/guest-pay-view.tsx'
import { ReceiptLoading } from '#/components/receipt/receipt-states.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { useGuestBillSession } from '#/hooks/use-guest-bill-session.ts'
import { useGuestClaimSession } from '#/hooks/use-guest-claim-session.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import { mapGuestBillToClaimSessionInput } from '../../../../shared/guest-flow-session.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/pay')({
  head: () => buildNoIndexHead('Плащане'),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === 'string' ? search.t : '',
  }),
  component: BillPayPage,
})

const EMPTY_ITEMS: never[] = []

function BillPayPage() {
  const { billId: billIdParam } = Route.useParams()
  const { t: shareTokenFromUrl } = Route.useSearch()
  const billId = billIdParam as Id<'bills'>

  return (
    <QueryErrorBoundary resetKey={`${billId}:${shareTokenFromUrl}:pay`}>
      <GuestPayContent billId={billId} shareTokenFromUrl={shareTokenFromUrl} />
    </QueryErrorBoundary>
  )
}

function GuestPayContent({
  billId,
  shareTokenFromUrl,
}: {
  billId: Id<'bills'>
  shareTokenFromUrl: string
}) {
  const {
    gate,
    data,
    pendingCover,
    shareToken,
    storedSession,
    participantId,
    mySeatIds,
    readOnly,
    labels,
  } = useGuestBillSession(billId, shareTokenFromUrl)
  const activeSeats = useQuery(
    api.guestSessions.listActiveForBill,
    shareToken ? { billId, shareToken } : 'skip',
  )

  const claimInput = useMemo(
    () => (data ? mapGuestBillToClaimSessionInput(data) : null),
    [data],
  )
  const { session } = useGuestClaimSession({
    items: claimInput?.items ?? EMPTY_ITEMS,
    assignments: claimInput?.assignments ?? EMPTY_ITEMS,
    participants: claimInput?.participants ?? EMPTY_ITEMS,
    seatId: participantId,
    mySeatIds,
    billRelations: claimInput?.billRelations,
    billContext: claimInput?.billContext,
  })

  if (
    gate.status !== 'ready' ||
    !data ||
    !storedSession ||
    !participantId ||
    !session
  ) {
    return <ReceiptLoading />
  }

  const heldElsewhereIds = (activeSeats ?? [])
    .filter(
      (seat) =>
        seat.heldByParticipantId !== undefined &&
        seat.heldByParticipantId !== participantId,
    )
    .map((seat) => seat.participantId as string)

  return (
    <GuestPayView
      billId={billId}
      shareToken={shareToken}
      sessionToken={storedSession.sessionToken}
      data={data}
      payerId={participantId}
      mySeatIds={mySeatIds}
      seatShares={session.seatShares}
      freeUnits={session.tableProgress.freeUnits}
      labels={labels}
      readOnly={readOnly}
      pendingCover={pendingCover ?? null}
      heldElsewhereIds={heldElsewhereIds}
    />
  )
}
