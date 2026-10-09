// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { CLEANUP_BATCH_SIZE } from './cleanup'
import { GUEST_SESSION_TTL_MS } from './lib/guestSession'
import {
  hostTakesUnits,
  joinAsGuest,
  reserve,
  seedBill,
  setupConvex,
} from './test.setup'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

afterEach(() => {
  vi.useRealTimers()
})

describe('the cleanup cron', () => {
  it('purges stale phones, buckets and scans and keeps what is still live', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedBill(t, {
      guests: ['Ани', 'Боби', 'Вики'],
      items: [{ name: 'Бира', unitPriceCents: 300, quantity: 3 }],
    })
    await hostTakesUnits(bill, bill.itemIds[0], Object.values(bill.seats))
    const ani = await joinAsGuest(t, bill, bill.seats['Ани'])
    const bobi = await joinAsGuest(t, bill, bill.seats['Боби'])
    const unsent = await reserve(t, {
      billId: bill.billId,
      sessionToken: ani.sessionToken,
      otherParticipantIds: [bill.seats['Вики']],
    })
    const sent = await t.mutation(api.combinedPayments.recordTransfer, {
      billId: bill.billId,
      sessionToken: bobi.sessionToken,
      otherParticipantIds: [],
    })
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(['receipt'], { type: 'image/jpeg' })),
    )
    const old = Date.now() - 31 * DAY_MS
    await t.run(async (ctx) => {
      await ctx.db.insert('rateLimitBuckets', {
        key: 'claim:bill:stale',
        windowStart: Date.now() - 3 * HOUR_MS,
        count: 1,
      })
      await ctx.db.insert('rateLimitBuckets', {
        key: 'usage:user:bills:2026-01',
        windowStart: old,
        count: 4,
      })
      for (const status of ['processing', 'done'] as const) {
        await ctx.db.insert('receiptScans', {
          billId: bill.billId,
          storageId,
          status,
          createdAt: old,
        })
      }
    })

    // Вики keeps her phone awake; Ани and Боби go quiet past the TTL.
    const vicky = await joinAsGuest(t, bill, bill.seats['Вики'])
    vi.setSystemTime(Date.now() + GUEST_SESSION_TTL_MS - 1_000)
    await t.mutation(api.guestSessions.heartbeat, {
      billId: bill.billId,
      ...vicky,
    })
    vi.setSystemTime(Date.now() + 2_000)
    const result = await t.mutation(internal.cleanup.run, {})

    expect(result).toMatchObject({ purgedSessions: 2, purgedScans: 2 })
    const left = await t.run(async (ctx) => ({
      sessions: (await ctx.db.query('guestSessions').collect()).map(
        (session) => session.sessionToken,
      ),
      bucketKeys: (await ctx.db.query('rateLimitBuckets').collect()).map(
        (bucket) => bucket.key,
      ),
      scans: (await ctx.db.query('receiptScans').collect()).length,
      unsent: (await ctx.db.get(unsent.requestId))?.status,
      sent: (await ctx.db.get(sent.requestId))?.status,
    }))
    expect(left.sessions).toEqual([vicky.sessionToken])
    expect(left.bucketKeys).toContain('usage:user:bills:2026-01')
    expect(left.bucketKeys).not.toContain('claim:bill:stale')
    expect(left.scans).toBe(0)
    expect(left.unsent).toBe('cancelled')
    expect(left.sent).toBe('pending')
  })

  it('stale buckets behind thousands of live usage counters still go', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const now = Date.now()
    await t.run(async (ctx) => {
      for (let index = 0; index < 300; index++) {
        await ctx.db.insert('rateLimitBuckets', {
          key: `heartbeat:old-${index}`,
          windowStart: now - 20 * DAY_MS,
          count: 1,
        })
      }
      for (let index = 0; index < 2_100; index++) {
        await ctx.db.insert('rateLimitBuckets', {
          key: `usage:user-${index}:bills:2026-10`,
          windowStart: now - 3 * DAY_MS,
          count: 1,
        })
      }
      await ctx.db.insert('rateLimitBuckets', {
        key: 'usage:user-0:bills:2026-07',
        windowStart: now - 70 * DAY_MS,
        count: 3,
      })
    })

    await t.mutation(internal.cleanup.run, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const keys = await t.run(async (ctx) =>
      (await ctx.db.query('rateLimitBuckets').collect()).map((row) => row.key),
    )
    expect(keys).toHaveLength(2_100)
    expect(keys.every((key) => key.endsWith(':2026-10'))).toBe(true)
  })

  it('works off a backlog bigger than one batch over follow-up runs', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const stale = Date.now() - 3 * HOUR_MS
    await t.run(async (ctx) => {
      for (let index = 0; index < CLEANUP_BATCH_SIZE * 2 + 50; index++) {
        await ctx.db.insert('rateLimitBuckets', {
          key: `heartbeat:token-${index}`,
          windowStart: stale,
          count: 1,
        })
      }
    })

    await t.mutation(internal.cleanup.run, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(
      await t.run(
        async (ctx) =>
          (await ctx.db.query('rateLimitBuckets').collect()).length,
      ),
    ).toBe(0)
  })
})

describe('the orphan upload sweep', () => {
  const store = (t: ReturnType<typeof setupConvex>) =>
    t.run((ctx) =>
      ctx.storage.store(new Blob(['photo'], { type: 'image/jpeg' })),
    )

  it('deletes day-old uploads nothing holds and keeps the rest', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedBill(t)
    const ownerId = (await t.run((ctx) => ctx.db.get(bill.billId)))!.ownerId
    const orphan = await store(t)
    const onBill = await store(t)
    const onQuickScan = await store(t)
    const onReceiptScan = await store(t)
    await t.run(async (ctx) => {
      await ctx.db.patch(bill.billId, { receiptStorageId: onBill })
      await ctx.db.insert('quickScans', {
        ownerId,
        storageId: onQuickScan,
        status: 'processing',
        createdAt: Date.now(),
      })
      await ctx.db.insert('receiptScans', {
        billId: bill.billId,
        storageId: onReceiptScan,
        status: 'done',
        createdAt: Date.now(),
      })
    })

    vi.setSystemTime(Date.now() + DAY_MS + HOUR_MS)
    const fresh = await store(t)
    const result = await t.mutation(internal.cleanup.sweepOrphanUploads, {})

    expect(result).toEqual({ deletedUploads: 1 })
    const left = await t.run(async (ctx) =>
      (await ctx.db.system.query('_storage').collect()).map((file) => file._id),
    )
    expect(left).not.toContain(orphan)
    expect(left).toEqual(
      expect.arrayContaining([onBill, onQuickScan, onReceiptScan, fresh]),
    )
  })

  it('keeps an unheld upload that is younger than a day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const storageId = await store(t)

    vi.setSystemTime(Date.now() + DAY_MS - HOUR_MS)
    await t.mutation(internal.cleanup.sweepOrphanUploads, {})

    expect(
      await t.run((ctx) => ctx.db.system.get('_storage', storageId)),
    ).not.toBeNull()
  })

  it('works off more orphans than one batch over follow-up runs', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const bill = await seedBill(t)
    const kept = await store(t)
    await t.run((ctx) => ctx.db.patch(bill.billId, { receiptStorageId: kept }))
    for (let index = 0; index < 250; index++) await store(t)

    vi.setSystemTime(Date.now() + 2 * DAY_MS)
    await t.mutation(internal.cleanup.sweepOrphanUploads, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const left = await t.run(async (ctx) =>
      (await ctx.db.system.query('_storage').collect()).map((file) => file._id),
    )
    expect(left).toEqual([kept])
  })
})
