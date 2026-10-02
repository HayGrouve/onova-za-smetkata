import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import { PAST_DUE_GRACE_MS } from './hostTier'

/** The parts of a Stripe Subscription the Host Pro mirror needs (Stripe.Subscription fits). */
export interface StripeSubscriptionLike {
  id: string
  status: string
  created: number
  cancel_at_period_end: boolean
  ended_at: number | null
  items: { data: ReadonlyArray<{ current_period_end: number }> }
}

export const subscriptionSnapshotValidator = v.object({
  id: v.string(),
  status: v.string(),
  currentPeriodEnd: v.union(v.number(), v.null()),
  cancelAtPeriodEnd: v.boolean(),
  endedAt: v.union(v.number(), v.null()),
})

/** A Stripe Subscription reduced to what Convex stores (times in ms). */
export type SubscriptionSnapshot = Infer<typeof subscriptionSnapshotValidator>

/** Statuses where the Host is paying, or Stripe is still retrying, for Pro. */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])
/** Statuses that may still turn live (payment pending, paused, unpaid). */
const PENDING_STATUSES = new Set(['incomplete', 'paused', 'unpaid'])
/** Statuses where the subscription is over for good. */
const ENDED_STATUSES = new Set(['canceled', 'incomplete_expired'])

function statusRank(status: string): number {
  if (LIVE_STATUSES.has(status)) return 0
  if (PENDING_STATUSES.has(status)) return 1
  return 2
}

/** The one subscription that decides Host Pro when a customer has several. */
export function pickCurrentSubscription<T extends StripeSubscriptionLike>(
  subscriptions: ReadonlyArray<T>,
): T | null {
  let best: T | null = null
  for (const subscription of subscriptions) {
    if (
      !best ||
      statusRank(subscription.status) < statusRank(best.status) ||
      (statusRank(subscription.status) === statusRank(best.status) &&
        subscription.created > best.created)
    ) {
      best = subscription
    }
  }
  return best
}

export function toSubscriptionSnapshot(
  subscription: StripeSubscriptionLike,
): SubscriptionSnapshot {
  const periodEnds = subscription.items.data.map(
    (item) => item.current_period_end,
  )
  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodEnd:
      periodEnds.length > 0 ? Math.max(...periodEnds) * 1000 : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    endedAt:
      subscription.ended_at === null ? null : subscription.ended_at * 1000,
  }
}

export function isLiveSubscriptionStatus(status: string | undefined): boolean {
  return status !== undefined && LIVE_STATUSES.has(status)
}

type BillingMirror = Pick<
  Doc<'users'>,
  | 'plan'
  | 'subscriptionStatus'
  | 'currentPeriodEnd'
  | 'graceUntil'
  | 'cancelAtPeriodEnd'
  | 'stripeSubscriptionId'
>

/**
 * The `users` billing mirror for a Stripe subscription (`null`: none). Read by
 * `getEffectiveTier`; an ended subscription keeps its end time so access stops.
 */
export function billingFieldsFromSubscription(
  subscription: SubscriptionSnapshot | null,
  previous: Pick<Doc<'users'>, 'subscriptionStatus' | 'graceUntil'>,
  nowMs: number,
): BillingMirror {
  if (!subscription) {
    return {
      plan: 'free',
      subscriptionStatus: undefined,
      currentPeriodEnd: undefined,
      graceUntil: undefined,
      cancelAtPeriodEnd: undefined,
      stripeSubscriptionId: undefined,
    }
  }

  const ended = ENDED_STATUSES.has(subscription.status)
  const isPastDue = subscription.status === 'past_due'
  const keepGrace =
    isPastDue &&
    previous.subscriptionStatus === 'past_due' &&
    previous.graceUntil !== undefined

  return {
    plan: 'pro',
    subscriptionStatus: subscription.status,
    currentPeriodEnd: ended
      ? (subscription.endedAt ?? nowMs)
      : (subscription.currentPeriodEnd ?? undefined),
    graceUntil: isPastDue
      ? keepGrace
        ? previous.graceUntil
        : nowMs + PAST_DUE_GRACE_MS
      : undefined,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    stripeSubscriptionId: subscription.id,
  }
}
