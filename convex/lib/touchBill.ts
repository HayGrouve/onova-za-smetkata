import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

export async function touchBill(ctx: MutationCtx, billId: Id<'bills'>) {
  await ctx.db.patch(billId, { updatedAt: Date.now() })
}
