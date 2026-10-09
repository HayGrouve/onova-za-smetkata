import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { buildListSummaryFields, loadBillRelations } from './billListSummary'
import type { BillListSummaryFields } from './billListSummary'

/**
 * A touch that changes no stored summary field skips the write while the bill
 * was bumped this recently. Every write to the bill re-runs every live query
 * on it (each Guest phone's bill view, the seat list, the Host's screens and
 * home), so a burst of edits that move no totals — renaming a line, saving a
 * field unchanged — should not wake them all. Past this window the touch still
 * bumps `updatedAt`, so the home list keeps its last-edited order.
 */
const TOUCH_BILL_DEBOUNCE_MS = 60_000

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a)) {
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameValue(item, b[index]))
    )
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null ||
    Array.isArray(b)
  ) {
    return false
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => key in right && sameValue(left[key], right[key]))
  )
}

function storesSummary(
  bill: Doc<'bills'>,
  summary: BillListSummaryFields,
): boolean {
  return (Object.keys(summary) as (keyof BillListSummaryFields)[]).every(
    (key) => sameValue(bill[key], summary[key]),
  )
}

/** Recompute the bill's stored list and collection fields after an edit. */
export async function touchBill(ctx: MutationCtx, billId: Id<'bills'>) {
  const now = Date.now()
  const bill = await ctx.db.get(billId)
  if (!bill) {
    // Nothing to recompute; patching still throws on a missing bill, as before.
    await ctx.db.patch(billId, { updatedAt: now })
    return
  }
  const summary = buildListSummaryFields(
    bill,
    await loadBillRelations(ctx, billId),
  )
  if (
    now - bill.updatedAt < TOUCH_BILL_DEBOUNCE_MS &&
    storesSummary(bill, summary)
  ) {
    return
  }
  await ctx.db.patch(billId, { updatedAt: now, ...summary })
}
