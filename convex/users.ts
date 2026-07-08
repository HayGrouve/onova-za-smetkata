import { getAuthUserId } from '@convex-dev/auth/server'
import { query } from './_generated/server'

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

    return { label, name, email, image: user.image }
  },
})
