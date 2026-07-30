import type { Id } from '../../convex/_generated/dataModel'

type FinalizeNavigate = (options: {
  to: '/bills/$billId/summary'
  params: { billId: Id<'bills'> }
  replace: true
}) => Promise<void>

/** Shared post-finalize navigation for header menu and step 4 CTA. */
export async function navigateToFinalBillSummary(
  navigate: FinalizeNavigate,
  billId: Id<'bills'>,
) {
  await navigate({
    to: '/bills/$billId/summary',
    params: { billId },
    replace: true,
  })
}
