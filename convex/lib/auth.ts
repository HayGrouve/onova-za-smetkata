import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { assertBillOwnedBy } from './bill_ownership'

export { assertBillOwnedBy } from './bill_ownership'

export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'>> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity?.subject) {
    throw new ConvexError('Изисква се вход')
  }

  const existing = await ctx.db
    .query('users')
    .withIndex('by_clerkSubject', (q) => q.eq('clerkSubject', identity.subject))
    .unique()
  if (existing) return existing._id

  return await ctx.db.insert('users', {
    clerkSubject: identity.subject,
    email: identity.email,
    name: identity.name,
    image: identity.pictureUrl,
    clerkPlanSlug: 'free_user',
  })
}

export async function getOptionalAuthUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity?.subject) return null

  const existing = await ctx.db
    .query('users')
    .withIndex('by_clerkSubject', (q) => q.eq('clerkSubject', identity.subject))
    .unique()
  return existing?._id ?? null
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
