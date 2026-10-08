import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { loadBillRelations } from './billListSummary'
import { endGuestSessionsForBill } from './guestSession'
import { clearGuidedBillReference } from './hostOnboardingBillHooks'
import { onBillDeleted } from './payRequest'
import {
  deleteReceiptScansForBill,
  deleteReceiptStorageFile,
} from './receiptStorage'

/**
 * Deletes a bill and everything that hangs off it: receipt scans and photo,
 * Guest sessions, Pay requests, lines with their Unit memberships, seats and
 * payments. Callers check who may delete it.
 */
export async function deleteBillWithRelations(
  ctx: MutationCtx,
  bill: Doc<'bills'>,
): Promise<void> {
  await deleteReceiptScansForBill(ctx, bill._id)
  await endGuestSessionsForBill(ctx, bill._id)
  await onBillDeleted(ctx, bill._id)

  const { participants, items, payments } = await loadBillRelations(
    ctx,
    bill._id,
  )

  for (const item of items) {
    const assignments = await ctx.db
      .query('itemAssignments')
      .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
      .collect()
    for (const a of assignments) await ctx.db.delete(a._id)
    await ctx.db.delete(item._id)
  }
  for (const p of participants) await ctx.db.delete(p._id)
  for (const pay of payments) await ctx.db.delete(pay._id)
  await ctx.db.delete(bill._id)

  await clearGuidedBillReference(ctx, bill.ownerId, bill._id)

  if (bill.receiptStorageId) {
    await deleteReceiptStorageFile(ctx, bill.receiptStorageId)
  }
}
