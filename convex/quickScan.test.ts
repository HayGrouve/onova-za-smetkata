// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { HOST_IDENTITY, setupConvex } from './test.setup'
import type { TestConvex } from './test.setup'

const OTHER_HOST = { subject: 'user_other', name: 'Друг' }
const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

type Host = ReturnType<TestConvex['withIdentity']>

beforeEach(() => {
  // The scheduled read must never reach Gemini from a test: without a key it
  // marks the scan failed straight away.
  vi.stubEnv('GEMINI_API_KEY', '')
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function storePhoto(t: TestConvex) {
  return await t.run((ctx) =>
    ctx.storage.store(new Blob(['receipt'], { type: 'image/jpeg' })),
  )
}

async function photoExists(t: TestConvex, storageId: Id<'_storage'>) {
  return await t.run(
    async (ctx) => (await ctx.db.system.get('_storage', storageId)) !== null,
  )
}

/** Start a scan that must be accepted. */
async function startScan(host: Host, storageId: Id<'_storage'>) {
  const started = await host.mutation(api.quickScan.start, { storageId })
  if (!started.ok) throw new Error(started.message)
  return started.scanId
}

describe('quick bill scans', () => {
  it('count against the monthly receipt scans but never as a bill', async () => {
    vi.stubEnv('BILLING_ENABLED', 'true')
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)

    for (let index = 0; index < 5; index++) {
      await startScan(host, await storePhoto(t))
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    }
    await expect(
      host.mutation(api.quickScan.generateUploadUrl, {}),
    ).rejects.toMatchObject({ data: { code: 'QUOTA_OCR' } })
    const storageId = await storePhoto(t)
    expect(
      await host.mutation(api.quickScan.start, { storageId }),
    ).toMatchObject({ ok: false, quota: true })
    // A refused photo is not left behind in storage.
    expect(await photoExists(t, storageId)).toBe(false)

    // Five Free bills are still there to make.
    for (let index = 0; index < 5; index++) {
      await host.mutation(api.bills.create, {})
    }
  })

  it('share the hourly scan cap with bill scans', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    let started = 0
    let refused: Id<'_storage'> | null = null
    for (let index = 0; index < 25 && !refused; index++) {
      const storageId = await storePhoto(t)
      const result = await host.mutation(api.quickScan.start, { storageId })
      if (result.ok) started++
      else refused = storageId
    }
    expect(started).toBe(20)
    expect(refused && (await photoExists(t, refused))).toBe(false)

    const billId = await host.mutation(api.bills.create, {})
    await host.mutation(api.bills.update, {
      billId,
      receiptStorageId: await storePhoto(t),
    })
    await expect(
      host.mutation(api.receiptScan.startScan, { billId }),
    ).rejects.toThrow()
  })

  it('only read a fresh upload, never a file something else holds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)

    const once = await storePhoto(t)
    await startScan(host, once)
    await expect(
      host.mutation(api.quickScan.start, { storageId: once }),
    ).rejects.toThrow()

    // A bill's receipt is not the scan's to delete, however fresh.
    const billId = await host.mutation(api.bills.create, {})
    const billReceipt = await storePhoto(t)
    await host.mutation(api.bills.update, {
      billId,
      receiptStorageId: billReceipt,
    })
    await expect(
      host.mutation(api.quickScan.start, { storageId: billReceipt }),
    ).rejects.toThrow()
    expect(await photoExists(t, billReceipt)).toBe(true)

    // Nor is any photo uploaded long ago.
    const old = await storePhoto(t)
    vi.setSystemTime(Date.now() + 11 * MINUTE_MS)
    await expect(
      host.mutation(api.quickScan.start, { storageId: old }),
    ).rejects.toThrow()
    expect(await photoExists(t, old)).toBe(true)
  })

  it('delete the photo as soon as the read is over and tell the phone why it failed', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    const storageId = await storePhoto(t)
    const scanId = await startScan(host, storageId)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(await host.query(api.quickScan.get, { scanId })).toMatchObject({
      status: 'failed',
      errorMessage: expect.any(String),
    })
    expect(await photoExists(t, storageId)).toBe(false)
  })

  it('hand the read lines to the phone, which then discards the scan', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    const storageId = await storePhoto(t)
    const scanId = await startScan(host, storageId)
    await t.mutation(internal.quickScan.markDone, {
      scanId,
      extractedRestaurantName: 'Механа',
      extractedItems: [
        { name: 'Бира', unitPriceCents: 300, quantity: 2, confidence: 'high' },
      ],
      receiptTotalCents: 600,
    })

    expect(await host.query(api.quickScan.get, { scanId })).toMatchObject({
      status: 'done',
      restaurantName: 'Механа',
      items: [{ name: 'Бира', unitPriceCents: 300, quantity: 2 }],
      receiptTotalCents: 600,
    })
    expect(await photoExists(t, storageId)).toBe(false)

    await host.mutation(api.quickScan.discard, { scanId })
    expect(await host.query(api.quickScan.get, { scanId })).toBeNull()
  })

  it('stay private to the Host who took the photo', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    const other = t.withIdentity(OTHER_HOST)
    const storageId = await storePhoto(t)
    const scanId = await startScan(host, storageId)

    expect(await other.query(api.quickScan.get, { scanId })).toBeNull()
    expect(await t.query(api.quickScan.get, { scanId })).toBeNull()
    await other.mutation(api.quickScan.discard, { scanId })
    expect(await host.query(api.quickScan.get, { scanId })).not.toBeNull()
    expect(await photoExists(t, storageId)).toBe(true)
  })

  it('need a signed-in Host to start', async () => {
    const t = setupConvex()
    await expect(
      t.mutation(api.quickScan.start, { storageId: await storePhoto(t) }),
    ).rejects.toThrow()
  })

  it('are swept with their photo when the phone never came back for them', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    const storageId = await storePhoto(t)
    const scanId = await startScan(host, storageId)
    // A second abandoned scan whose photo is already gone must not stop the sweep.
    const gone = await storePhoto(t)
    await startScan(host, gone)
    await t.run((ctx) => ctx.storage.delete(gone))

    vi.setSystemTime(Date.now() + DAY_MS + 1)
    const result = await t.mutation(internal.cleanup.run, {})

    expect(result.purgedQuickScans).toBe(2)
    expect(await host.query(api.quickScan.get, { scanId })).toBeNull()
    expect(await photoExists(t, storageId)).toBe(false)
  })
})
