import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { requireAuth } from './lib/auth'
import { createShareToken } from './lib/shareToken'
import { touchBill } from './lib/touchBill'
import { planHostParticipantOnBillCreate } from './lib/hostBillParticipant'
import {
  countOwnedBills,
  ensureHostOnboarding,
  getHostOnboardingForUser,
  tryMarkOnboardingComplete,
} from './lib/hostOnboarding'
import { formatUsernameError, parseUsername } from './lib/hostProfile'
import { isDevModeEnabled } from './lib/devMode'
import {
  isPreparedBill,
  isTerminalOnboardingLifecycle,
  planUsernameOnWelcomeConfirm,
} from '../shared/host-onboarding'

export const getForViewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const record = await getHostOnboardingForUser(ctx, userId)
    const billCount = await countOwnedBills(ctx, userId)

    if (!record) {
      return {
        billCount,
        lifecycle: 'notStarted' as const,
        guidedBillId: undefined,
        preparedAt: undefined,
        sharedAt: undefined,
        paymentCheckpointDismissed: false,
      }
    }

    return {
      billCount,
      lifecycle: record.lifecycle,
      guidedBillId: record.guidedBillId,
      preparedAt: record.preparedAt,
      sharedAt: record.sharedAt,
      paymentCheckpointDismissed: record.paymentCheckpointDismissed,
    }
  },
})

export const createFirstBill = mutation({
  args: {
    hostDisplayName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const owner = await ctx.db.get(userId)
    if (!owner) {
      throw new ConvexError('Потребителят не е намерен.')
    }

    const billCount = await countOwnedBills(ctx, userId)
    if (billCount > 0) {
      throw new ConvexError(
        'Първоначалните напътствия са само когато все още нямате сметки.',
      )
    }

    const onboarding = await ensureHostOnboarding(ctx, userId)
    if (
      onboarding.lifecycle === 'skipped' ||
      onboarding.lifecycle === 'completed'
    ) {
      throw new ConvexError('Напътствията вече са приключили.')
    }

    const parsed = parseUsername(args.hostDisplayName)
    if (!parsed.success) {
      throw new ConvexError(formatUsernameError(parsed.error))
    }
    if (!parsed.data) {
      throw new ConvexError('Името не може да е празно')
    }

    const confirmedName = parsed.data
    const usernamePlan = planUsernameOnWelcomeConfirm(
      confirmedName,
      owner.username,
      owner.name,
    )
    if (usernamePlan.shouldSaveUsername && usernamePlan.username) {
      await ctx.db.patch(userId, { username: usernamePlan.username })
    }

    const now = Date.now()
    const billId = await ctx.db.insert('bills', {
      ownerId: userId,
      restaurantName: '',
      date: now,
      status: 'draft',
      shareToken: createShareToken(),
      listBillTotalCents: 0,
      listParticipantNames: [],
      createdAt: now,
      updatedAt: now,
    })

    const hostPlan = planHostParticipantOnBillCreate({
      username: confirmedName,
      authName: null,
    })
    const hostParticipantId = await ctx.db.insert('participants', {
      billId,
      name: hostPlan.name,
      sortOrder: hostPlan.sortOrder,
    })
    await ctx.db.patch(billId, { hostParticipantId })
    await touchBill(ctx, billId)

    await ctx.db.patch(onboarding._id, {
      lifecycle: 'active',
      guidedBillId: billId,
      updatedAt: now,
    })

    return billId
  },
})

export const skip = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const onboarding = await ensureHostOnboarding(ctx, userId)
    if (
      onboarding.lifecycle === 'skipped' ||
      onboarding.lifecycle === 'completed'
    ) {
      return
    }

    const now = Date.now()
    await ctx.db.patch(onboarding._id, {
      lifecycle: 'skipped',
      skippedAt: now,
      updatedAt: now,
    })
  },
})

export const dismissPaymentCheckpoint = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const onboarding = await ensureHostOnboarding(ctx, userId)
    await ctx.db.patch(onboarding._id, {
      paymentCheckpointDismissed: true,
      updatedAt: Date.now(),
    })
  },
})

export const recordPreparedIfNeeded = mutation({
  args: {
    billId: v.id('bills'),
    restaurantName: v.string(),
    guestCount: v.number(),
    items: v.array(
      v.object({
        id: v.string(),
        unitPriceCents: v.number(),
        quantity: v.number(),
      }),
    ),
    assignments: v.array(
      v.object({
        itemId: v.string(),
        participantId: v.string(),
        unitIndex: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const onboarding = await getHostOnboardingForUser(ctx, userId)
    if (!onboarding || onboarding.lifecycle !== 'active') return
    if (onboarding.guidedBillId !== args.billId) return
    if (onboarding.preparedAt !== undefined) return

    if (
      !isPreparedBill({
        restaurantName: args.restaurantName,
        guestCount: args.guestCount,
        items: args.items,
        assignments: args.assignments,
      })
    ) {
      return
    }

    const now = Date.now()
    const patch: Record<string, unknown> = {
      preparedAt: now,
      updatedAt: now,
    }
    const completion = tryMarkOnboardingComplete({
      ...onboarding,
      preparedAt: now,
    })
    if (completion) {
      Object.assign(patch, completion)
    }

    await ctx.db.patch(onboarding._id, patch)
  },
})

export const recordShared = mutation({
  args: {
    billId: v.id('bills'),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const onboarding = await getHostOnboardingForUser(ctx, userId)
    if (!onboarding) return
    if (onboarding.guidedBillId !== args.billId) return
    if (
      onboarding.lifecycle !== 'active' &&
      onboarding.lifecycle !== 'skipped'
    ) {
      return
    }

    const now = Date.now()
    const patch: Record<string, unknown> = {
      sharedAt: onboarding.sharedAt ?? now,
      updatedAt: now,
    }

    if (onboarding.lifecycle === 'active') {
      const completion = tryMarkOnboardingComplete({
        ...onboarding,
        sharedAt: onboarding.sharedAt ?? now,
      })
      if (completion) {
        Object.assign(patch, completion)
      }
    }

    await ctx.db.patch(onboarding._id, patch)
  },
})

export const clearGuidedBill = mutation({
  args: {
    billId: v.id('bills'),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const onboarding = await getHostOnboardingForUser(ctx, userId)
    if (!onboarding || onboarding.guidedBillId !== args.billId) return
    if (onboarding.lifecycle !== 'active') return

    await ctx.db.patch(onboarding._id, {
      guidedBillId: undefined,
      preparedAt: undefined,
      updatedAt: Date.now(),
    })
  },
})

async function insertGuidedBillForOwner(
  ctx: MutationCtx,
  userId: Id<'users'>,
  owner: Doc<'users'>,
) {
  const now = Date.now()
  const billId = await ctx.db.insert('bills', {
    ownerId: userId,
    restaurantName: '',
    date: now,
    status: 'draft',
    shareToken: createShareToken(),
    listBillTotalCents: 0,
    listParticipantNames: [],
    createdAt: now,
    updatedAt: now,
  })

  const hostPlan = planHostParticipantOnBillCreate({
    username: owner.username,
    authName: owner.name,
  })
  const hostParticipantId = await ctx.db.insert('participants', {
    billId,
    name: hostPlan.name,
    sortOrder: hostPlan.sortOrder,
  })
  await ctx.db.patch(billId, { hostParticipantId })
  await touchBill(ctx, billId)

  return billId
}

export const startGuidedBillWithExistingBills = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const owner = await ctx.db.get(userId)
    if (!owner) {
      throw new ConvexError('Потребителят не е намерен.')
    }

    const billCount = await countOwnedBills(ctx, userId)
    if (billCount === 0) {
      throw new ConvexError(
        'Първоначалните напътствия изискват потвърждение на името ви.',
      )
    }

    const onboarding = await ensureHostOnboarding(ctx, userId)
    if (isTerminalOnboardingLifecycle(onboarding.lifecycle)) {
      throw new ConvexError('Напътствията вече са приключили.')
    }
    if (onboarding.guidedBillId !== undefined) {
      throw new ConvexError('Вече имате активна сметка с напътствия.')
    }

    const billId = await insertGuidedBillForOwner(ctx, userId, owner)
    const now = Date.now()
    await ctx.db.patch(onboarding._id, {
      lifecycle: 'active',
      guidedBillId: billId,
      preparedAt: undefined,
      updatedAt: now,
    })

    return billId
  },
})

export const startAnotherGuidedBill = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const owner = await ctx.db.get(userId)
    if (!owner) {
      throw new ConvexError('Потребителят не е намерен.')
    }

    const onboarding = await getHostOnboardingForUser(ctx, userId)
    if (!onboarding || onboarding.lifecycle !== 'active') {
      throw new ConvexError('Напътствията не са активни.')
    }
    if (onboarding.guidedBillId !== undefined) {
      throw new ConvexError('Вече имате активна сметка с напътствия.')
    }

    const billId = await insertGuidedBillForOwner(ctx, userId, owner)
    const now = Date.now()
    await ctx.db.patch(onboarding._id, {
      guidedBillId: billId,
      preparedAt: undefined,
      updatedAt: now,
    })

    return billId
  },
})

/** DEV only — reset persisted onboarding so the first-run flow can be re-tested. */
export const resetForDevTesting = mutation({
  args: {},
  handler: async (ctx) => {
    if (!isDevModeEnabled()) {
      throw new ConvexError('Недостъпно извън DEV_MODE.')
    }

    const userId = await requireAuth(ctx)
    const record = await getHostOnboardingForUser(ctx, userId)
    if (!record) return

    const now = Date.now()
    await ctx.db.patch(record._id, {
      lifecycle: 'notStarted',
      guidedBillId: undefined,
      preparedAt: undefined,
      sharedAt: undefined,
      skippedAt: undefined,
      completedAt: undefined,
      paymentCheckpointDismissed: false,
      updatedAt: now,
    })
  },
})
