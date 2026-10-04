// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { CLEANUP_BATCH_SIZE } from './cleanup'
import { GUEST_SESSION_TTL_MS } from './lib/guestSession'
import {
  hostTakesUnits,
  joinAsGuest,
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
    const unsent = await t.mutation(api.combinedPayments.create, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      sessionToken: ani.sessionToken,
      coveredParticipantIds: [bill.seats['Вики']],
    })
    const sent = await t.mutation(api.combinedPayments.createSolo, {
      billId: bill.billId,
      shareToken: bill.shareToken,
      sessionToken: bobi.sessionToken,
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
      shareToken: bill.shareToken,
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
