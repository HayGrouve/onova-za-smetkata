import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'

export async function assertRateLimit(
  ctx: MutationCtx,
  key: string,
  max: number,
  windowMs: number,
  message = 'Твърде много заявки. Опитайте отново след малко.',
): Promise<void> {
  const now = Date.now()
  const existing = await ctx.db
    .query('rateLimitBuckets')
    .withIndex('by_key', (q) => q.eq('key', key))
    .first()

  if (!existing || now - existing.windowStart >= windowMs) {
    if (existing) await ctx.db.delete(existing._id)
    await ctx.db.insert('rateLimitBuckets', { key, windowStart: now, count: 1 })
    return
  }

  if (existing.count >= max) {
    throw new ConvexError(message)
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 })
}
