import { createFileRoute } from '@tanstack/react-router'
import { withReducedMotion } from '#/components/motion-root.tsx'
import { GuestPayView } from '#/components/guest/guest-pay-view.tsx'
import { ReceiptLoading } from '#/components/receipt/receipt-states.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { useActiveSeats } from '#/hooks/use-active-seats.ts'
import { useGuestBillSession } from '#/hooks/use-guest-bill-session.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/pay')({
  head: () => buildNoIndexHead('Плащане'),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === 'string' ? search.t : '',
  }),
  component: withReducedMotion(BillPayPage),
})

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
  const activeSeats = useActiveSeats(billId, shareToken)

  if (gate.status !== 'ready' || !data || !storedSession || !participantId) {
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
      activeSeats={activeSeats}
      labels={labels}
      readOnly={readOnly}
      pendingCover={pendingCover ?? null}
      heldElsewhereIds={heldElsewhereIds}
    />
  )
}
