// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  HOST_IDENTITY,
  hostTakesUnits,
  joinAsGuest,
  seedBill,
  setupConvex,
} from './test.setup'
import type { TestConvex } from './test.setup'

const OTHER_HOST = { subject: 'user_other', name: 'Друг' }

afterEach(() => {
  vi.useRealTimers()
})

async function userIdFor(t: TestConvex, subject: string) {
  return await t.run(async (ctx) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkSubject', (q) => q.eq('clerkSubject', subject))
      .unique()
    return user?._id ?? null
  })
}

/** Every row and file in the deployment, counted per table. */
async function countEverything(t: TestConvex) {
  return await t.run(async (ctx) => {
    const tables = [
      'users',
      'bills',
      'participants',
      'items',
      'itemAssignments',
      'payments',
      'guestSessions',
      'combinedPaymentRequests',
      'receiptScans',
      'quickScans',
      'paymentSettings',
      'friendGroups',
      'hostOnboarding',
      'rateLimitBuckets',
    ] as const
    const counts: Record<string, number> = {}
    for (const table of tables) {
      counts[table] = (await ctx.db.query(table).collect()).length
    }
    counts.files = (await ctx.db.system.query('_storage').collect()).length
    return counts
  })
}

/** A Host with everything the app stores about one: bills, guests, money, settings, photos. */
async function seedFullHost(
  t: TestConvex,
  identity: { subject: string; name?: string },
) {
  const bill = await seedBill(t, {
    hostIdentity: identity,
    guests: ['Ани', 'Боби'],
    items: [{ name: 'Бира', unitPriceCents: 300, quantity: 2 }],
  })
  await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
  const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
  await t.mutation(api.combinedPayments.recordTransfer, {
    billId: bill.billId,
    sessionToken: ani.sessionToken,
    otherParticipantIds: [],
  })
  await bill.host.mutation(api.payments.add, {
    billId: bill.billId,
    participantId: bill.seats['Боби'],
    amountCents: 300,
  })
  await bill.host.mutation(api.paymentSettings.save, {
    revolutUsername: 'someone',
    iban: 'BG80BNBG96611020345678',
  })
  await bill.host.mutation(api.friendGroups.create, {
    name: 'Петък',
    memberNames: ['Ани', 'Боби'],
  })
  const second = await bill.host.mutation(api.bills.create, {})

  const userId = await userIdFor(t, identity.subject)
  if (!userId) throw new Error('seedFullHost: the Host has no user row')
  await t.run(async (ctx) => {
    const photo = () =>
      ctx.storage.store(new Blob(['receipt'], { type: 'image/jpeg' }))
    const receipt = await photo()
    await ctx.db.patch(bill.billId, { receiptStorageId: receipt })
    await ctx.db.insert('receiptScans', {
      billId: bill.billId,
      storageId: receipt,
      status: 'done',
      createdAt: Date.now(),
    })
    await ctx.db.insert('quickScans', {
      ownerId: userId,
      storageId: await photo(),
      status: 'done',
      createdAt: Date.now(),
    })
    await ctx.db.insert('hostOnboarding', {
      userId,
      lifecycle: 'completed',
      paymentCheckpointDismissed: true,
      version: 1,
      updatedAt: Date.now(),
    })
    await ctx.db.insert('rateLimitBuckets', {
      key: `checkout:${userId}`,
      windowStart: Date.now(),
      count: 1,
    })
  })
  return { userId, billIds: [bill.billId, second] as Id<'bills'>[] }
}

describe('deleting a Host account', () => {
  it('erases every bill, setting, counter and photo of that Host and nothing else', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const other = await seedFullHost(t, OTHER_HOST)
    const before = await countEverything(t)
    const host = await seedFullHost(t, HOST_IDENTITY)

    const recorded = await t.mutation(
      internal.accountDeletion.recordUserDeleted,
      { eventId: 'msg_delete_1', clerkSubject: HOST_IDENTITY.subject },
    )
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(recorded).toBe(true)
    expect(await userIdFor(t, HOST_IDENTITY.subject)).toBeNull()
    // Guest-side throttles are keyed by bill and phone, not by the Host;
    // they hold no personal data and the cleanup cron drops them within 2 h.
    const { rateLimitBuckets: _left, ...after } = await countEverything(t)
    const { rateLimitBuckets: _kept, ...expected } = before
    expect(after).toEqual(expected)
    const keys = await t.run(async (ctx) =>
      (await ctx.db.query('rateLimitBuckets').collect()).map((row) => row.key),
    )
    expect(keys.filter((key) => key.includes(host.userId))).toEqual([])
    expect(keys).toContain(`checkout:${other.userId}`)
    const leftBills = await t.run(async (ctx) =>
      (await ctx.db.query('bills').collect()).map((bill) => bill._id),
    )
    expect(leftBills.sort()).toEqual([...other.billIds].sort())
    expect(leftBills).not.toContain(host.billIds[0])
  })

  it('handles a repeated delivery once and ignores an unknown account', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    await seedFullHost(t, HOST_IDENTITY)

    const first = await t.mutation(internal.accountDeletion.recordUserDeleted, {
      eventId: 'msg_delete_1',
      clerkSubject: HOST_IDENTITY.subject,
    })
    const again = await t.mutation(internal.accountDeletion.recordUserDeleted, {
      eventId: 'msg_delete_1',
      clerkSubject: HOST_IDENTITY.subject,
    })
    const stranger = await t.mutation(
      internal.accountDeletion.recordUserDeleted,
      { eventId: 'msg_delete_2', clerkSubject: 'user_never_signed_in' },
    )
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect([first, again, stranger]).toEqual([true, false, true])
    expect(await userIdFor(t, HOST_IDENTITY.subject)).toBeNull()
  })
})

/** What the Host's phone shows on Home: their bills, or null when signed out. */
async function homeBillIds(t: TestConvex, subject: string) {
  const userId = await userIdFor(t, subject)
  if (!userId) return []
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query('bills')
        .withIndex('by_ownerId_updatedAt', (q) => q.eq('ownerId', userId))
        .collect()
    ).map((bill) => bill._id),
  )
}

async function scheduledCancels(t: TestConvex) {
  return await t.run(async (ctx) =>
    (await ctx.db.system.query('_scheduled_functions').collect())
      .filter((job) => job.name.includes('cancelSubscription'))
      .map((job) => job.args[0] as { subscriptionId: string }),
  )
}

async function giveLiveSubscription(t: TestConvex, userId: Id<'users'>) {
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, {
      plan: 'pro',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      subscriptionStatus: 'active',
    })
  })
}

describe('Изтрий данните (deleteMyData)', () => {
  it('drops the users row at once, then erases every bill, setting and row of that Host and nothing else', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const other = await seedFullHost(t, OTHER_HOST)
    const before = await countEverything(t)
    const host = await seedFullHost(t, HOST_IDENTITY)

    await t
      .withIdentity(HOST_IDENTITY)
      .mutation(api.accountDeletion.deleteMyData, {})
    expect(await userIdFor(t, HOST_IDENTITY.subject)).toBeNull()

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const { rateLimitBuckets: _left, ...after } = await countEverything(t)
    const { rateLimitBuckets: _kept, ...expected } = before
    expect(after).toEqual(expected)
    const keys = await t.run(async (ctx) =>
      (await ctx.db.query('rateLimitBuckets').collect()).map((row) => row.key),
    )
    expect(keys.filter((key) => key.includes(host.userId))).toEqual([])
    expect(await homeBillIds(t, OTHER_HOST.subject)).toEqual(
      expect.arrayContaining(other.billIds),
    )
  })

  it('leaves the same person a brand new Host whose new bills the eraser does not touch', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const old = await seedFullHost(t, HOST_IDENTITY)
    const host = t.withIdentity(HOST_IDENTITY)

    await host.mutation(api.accountDeletion.deleteMyData, {})
    // Before the background erase runs, the Host is back on Home and starts over.
    const freshBill = await host.mutation(api.bills.create, {})
    const freshUserId = await userIdFor(t, HOST_IDENTITY.subject)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(freshUserId).not.toBeNull()
    expect(freshUserId).not.toBe(old.userId)
    expect(await homeBillIds(t, HOST_IDENTITY.subject)).toEqual([freshBill])
    const { paymentSettings, friendGroups } = await countEverything(t)
    expect({ paymentSettings, friendGroups }).toEqual({
      paymentSettings: 0,
      friendGroups: 0,
    })
  })

  it('cancels a live subscription by the id noted when the row went', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const host = await seedFullHost(t, HOST_IDENTITY)
    await giveLiveSubscription(t, host.userId)

    await t
      .withIdentity(HOST_IDENTITY)
      .mutation(api.accountDeletion.deleteMyData, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(await scheduledCancels(t)).toEqual([{ subscriptionId: 'sub_1' }])
  })

  it('cancels nothing for a subscription that already ended', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const host = await seedFullHost(t, HOST_IDENTITY)
    await giveLiveSubscription(t, host.userId)
    await t.run((ctx) =>
      ctx.db.patch(host.userId, {
        plan: 'free',
        subscriptionStatus: 'canceled',
      }),
    )

    await t
      .withIdentity(HOST_IDENTITY)
      .mutation(api.accountDeletion.deleteMyData, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(await scheduledCancels(t)).toEqual([])
  })

  it('needs a signed in Host', async () => {
    const t = setupConvex()
    await expect(
      t.mutation(api.accountDeletion.deleteMyData, {}),
    ).rejects.toThrow('Изисква се вход')
  })
})

describe('the shared eraser', () => {
  it('a deleted account (user.deleted) also cancels its live subscription', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const host = await seedFullHost(t, HOST_IDENTITY)
    await giveLiveSubscription(t, host.userId)

    await t.mutation(internal.accountDeletion.recordUserDeleted, {
      eventId: 'msg_delete_1',
      clerkSubject: HOST_IDENTITY.subject,
    })
    expect(await userIdFor(t, HOST_IDENTITY.subject)).toBeNull()
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(await scheduledCancels(t)).toEqual([{ subscriptionId: 'sub_1' }])
  })

  it('deleteHostData still erases a Host by users id (cutover fallback), with or without the row', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const host = await seedFullHost(t, HOST_IDENTITY)
    const other = await seedFullHost(t, OTHER_HOST)

    await t.mutation(internal.accountDeletion.deleteHostData, {
      userId: host.userId,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    // A second run for an id whose row is already gone is harmless.
    await t.mutation(internal.accountDeletion.deleteHostData, {
      userId: host.userId,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(await userIdFor(t, HOST_IDENTITY.subject)).toBeNull()
    const leftBills = await t.run(async (ctx) =>
      (await ctx.db.query('bills').collect()).map((bill) => bill._id),
    )
    expect(leftBills.sort()).toEqual([...other.billIds].sort())
  })
})
