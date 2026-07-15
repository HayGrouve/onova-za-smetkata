import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/auth'
import { formatUsernameError, parseUsername } from './lib/hostProfile'

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null

    const user = await ctx.db.get(userId)
    if (!user) return null

    const name = user.name?.trim()
    const email = user.email?.trim()
    const label = name || email || 'Потребител'
    const username = user.username?.trim() || undefined

    return { label, name, email, image: user.image, username }
  },
})

export const saveUsername = mutation({
  args: {
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const parsed = parseUsername(args.username ?? '')
    if (!parsed.success) {
      throw new ConvexError(formatUsernameError(parsed.error))
    }

    await ctx.db.patch(userId, { username: parsed.data })
  },
})
