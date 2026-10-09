import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { GuestClaimView } from '#/components/guest/guest-claim-view.tsx'
import { ReceiptLoading } from '#/components/receipt/receipt-states.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { useActiveSeats } from '#/hooks/use-active-seats.ts'
import { useGuestBillSession } from '#/hooks/use-guest-bill-session.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/claim')({
  head: () => buildNoIndexHead('Моят дял'),
  validateSearch: (
    search: Record<string, unknown>,
  ): { t?: string; mode?: 'host' } => ({
    t: typeof search.t === 'string' ? search.t : '',
    mode: search.mode === 'host' ? ('host' as const) : undefined,
  }),
  component: BillClaimPage,
})

function BillClaimPage() {
  const { billId: billIdParam } = Route.useParams()
  const { t: shareTokenFromUrl = '', mode } = Route.useSearch()
  const billId = billIdParam as Id<'bills'>

  if (mode === 'host') {
    return (
      <QueryErrorBoundary resetKey={`${billId}:host`}>
        <HostClaimContent billId={billId} />
      </QueryErrorBoundary>
    )
  }

  return (
    <QueryErrorBoundary resetKey={`${billId}:${shareTokenFromUrl}`}>
      <GuestClaimContent
        billId={billId}
        shareTokenFromUrl={shareTokenFromUrl}
      />
    </QueryErrorBoundary>
  )
}

function GuestClaimContent({
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
    handleSwitchIdentity,
  } = useGuestBillSession(billId, shareTokenFromUrl)
  const activeSeats = useActiveSeats(billId, shareToken)

  if (gate.status !== 'ready' || !data || !storedSession || !participantId) {
    return <ReceiptLoading />
  }

  return (
    <GuestClaimView
      billId={billId}
      shareToken={shareToken}
      sessionToken={storedSession.sessionToken}
      data={data}
      participantId={participantId}
      mySeatIds={mySeatIds}
      labels={labels}
      readOnly={readOnly}
      pendingCover={pendingCover ?? null}
      activeSeats={activeSeats}
      onSwitchIdentity={handleSwitchIdentity}
    />
  )
}

/**
 * The Host claims on the bill itself (their seat is a brush on the receipt),
 * so the old „Моите артикули“ page sends them to На масата.
 */
function HostClaimContent({ billId }: { billId: Id<'bills'> }) {
  const navigate = useNavigate()
  useEffect(() => {
    void navigate({
      to: '/bills/$billId',
      params: { billId },
      search: { step: 3 },
      replace: true,
    })
  }, [billId, navigate])
  return <ReceiptLoading />
}
