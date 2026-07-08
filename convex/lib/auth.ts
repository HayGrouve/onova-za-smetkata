import { ConvexError } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { assertBillOwnedBy } from './bill_ownership'

export { assertBillOwnedBy } from './bill_ownership'

export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) {
    throw new ConvexError('Изисква се вход')
  }
  return userId
}

export async function requireBillOwner(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
): Promise<Doc<'bills'>> {
  const userId = await requireAuth(ctx)
  const bill = await ctx.db.get(billId)
  if (!bill?.ownerId) {
    throw new ConvexError('Сметката не е намерена')
  }
  assertBillOwnedBy(bill, userId)
  return bill
}
