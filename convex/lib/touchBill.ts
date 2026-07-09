import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { computeBillListSummary } from './billListSummary'

export async function touchBill(ctx: MutationCtx, billId: Id<'bills'>) {
  const summary = await computeBillListSummary(ctx, billId)
  await ctx.db.patch(billId, {
    updatedAt: Date.now(),
    ...(summary
      ? {
          listBillTotalCents: summary.listBillTotalCents,
          listOutstandingCents: summary.listOutstandingCents,
          listParticipantNames: summary.listParticipantNames,
        }
      : {}),
  })
}
