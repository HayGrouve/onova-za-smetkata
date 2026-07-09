import { createFileRoute } from '@tanstack/react-router'
import { BillSummaryContent } from '#/components/bills/bill-summary-content.tsx'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/summary')({
  head: () => buildNoIndexHead('Обобщение'),
  component: BillSummary,
})

function BillSummary() {
  const params = Route.useParams()
  const billId = params.billId as Id<'bills'>
  const { isAuthenticated, isLoading: authLoading } = useRequireHostAuth(
    `/bills/${billId}/summary`,
  )

  if (authLoading || !isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  return (
    <div className="page-container-summary">
      <BillSummaryContent billId={billId} />
    </div>
  )
}
