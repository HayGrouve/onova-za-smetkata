import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { PAST_DUE_GRACE_MS } from './lib/hostTier'

type ClerkSubscriptionItemPayload = {
  payer?: { user_id?: string }
  items?: Array<{
    plan?: { slug?: string }
    period_end?: number
    status?: string
  }>
  status?: string
  period_end?: number
}

function parsePeriodEndMs(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value > 1_000_000_000_000 ? value : value * 1000
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

function extractPlanSlug(
  data: ClerkSubscriptionItemPayload,
): string | undefined {
  const itemSlug = data.items?.[0]?.plan?.slug
  if (itemSlug) return itemSlug
  return undefined
}

function extractPeriodEnd(
  data: ClerkSubscriptionItemPayload,
): number | undefined {
  return (
    parsePeriodEndMs(data.period_end) ??
    parsePeriodEndMs(data.items?.[0]?.period_end)
  )
}

export const applyBillingEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    clerkSubject: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('processedWebhookEvents')
      .withIndex('by_eventId', (q) => q.eq('eventId', args.eventId))
      .first()
    if (existing) return

    const data = args.payload as ClerkSubscriptionItemPayload
    const now = Date.now()
    const planSlug = extractPlanSlug(data)
    const periodEnd = extractPeriodEnd(data)

    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkSubject', (q) =>
        q.eq('clerkSubject', args.clerkSubject),
      )
      .unique()

    if (!user) {
      await ctx.db.insert('users', {
        clerkSubject: args.clerkSubject,
        clerkPlanSlug:
          args.eventType === 'subscriptionItem.active'
            ? (planSlug ?? 'pro')
            : 'free_user',
        subscriptionStatus:
          args.eventType === 'subscriptionItem.active'
            ? 'active'
            : args.eventType === 'subscriptionItem.pastDue'
              ? 'past_due'
              : undefined,
        currentPeriodEnd: periodEnd,
        graceUntil:
          args.eventType === 'subscriptionItem.pastDue'
            ? now + PAST_DUE_GRACE_MS
            : undefined,
      })
      await ctx.db.insert('processedWebhookEvents', {
        eventId: args.eventId,
        processedAt: now,
      })
      return
    }

    switch (args.eventType) {
      case 'subscriptionItem.active': {
        await ctx.db.patch(user._id, {
          clerkPlanSlug: planSlug ?? 'pro',
          subscriptionStatus: 'active',
          currentPeriodEnd: periodEnd,
          graceUntil: undefined,
        })
        break
      }
      case 'subscriptionItem.canceled': {
        await ctx.db.patch(user._id, {
          clerkPlanSlug: planSlug ?? user.clerkPlanSlug ?? 'pro',
          subscriptionStatus: 'canceled',
          currentPeriodEnd: periodEnd ?? user.currentPeriodEnd,
          graceUntil: undefined,
        })
        break
      }
      case 'subscriptionItem.pastDue': {
        await ctx.db.patch(user._id, {
          clerkPlanSlug: planSlug ?? user.clerkPlanSlug ?? 'pro',
          subscriptionStatus: 'past_due',
          graceUntil: now + PAST_DUE_GRACE_MS,
        })
        break
      }
      case 'subscription.updated': {
        const status = data.status ?? data.items?.[0]?.status
        if (
          status === 'active' ||
          status === 'past_due' ||
          status === 'canceled'
        ) {
          break
        }
        await ctx.db.patch(user._id, {
          clerkPlanSlug: 'free_user',
          subscriptionStatus: status ?? 'inactive',
          currentPeriodEnd: undefined,
          graceUntil: undefined,
        })
        break
      }
      default:
        break
    }

    await ctx.db.insert('processedWebhookEvents', {
      eventId: args.eventId,
      processedAt: now,
    })
  },
})
