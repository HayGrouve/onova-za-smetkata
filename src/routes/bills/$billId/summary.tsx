import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { HostBillView } from '#/components/host/host-bill-view.tsx'
import { BillHeaderTitleSync } from '#/components/layout/bill-header-title.tsx'
import { ReceiptLoading } from '#/components/receipt/receipt-states.tsx'
import { stepForPhase } from '#/components/receipt/timeline.tsx'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/summary')({
  head: () => buildNoIndexHead('Обобщение'),
  component: BillSummary,
})

/** The settled receipt: stamped „Приключена“ once the bill is final. */
function BillSummary() {
  const params = Route.useParams()
  const billId = params.billId as Id<'bills'>
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useRequireHostAuth(
    `/bills/${billId}/summary`,
  )
  const data = useQuery(api.bills.get, isAuthenticated ? { billId } : 'skip')

  if (authLoading || !isAuthenticated || data === undefined) {
    return <ReceiptLoading />
  }
  return (
    <>
      <BillHeaderTitleSync title={data.bill.restaurantName} />
      <HostBillView
        billId={billId}
        data={data}
        phase="settle"
        onPhase={
          data.bill.status === 'draft'
            ? (phase) =>
                void navigate({
                  to: '/bills/$billId',
                  params: { billId },
                  search: { step: stepForPhase(phase) },
                })
            : undefined
        }
      />
    </>
  )
}
