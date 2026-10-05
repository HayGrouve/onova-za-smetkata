// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { HOST_IDENTITY, setupConvex } from './test.setup'
import type { TestConvex } from './test.setup'

const OTHER_HOST = { subject: 'user_other', name: 'Друг' }
const DAY_MS = 24 * 60 * 60 * 1000

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

async function photoExists(t: TestConvex, storageId: string) {
  return await t.run(
    async (ctx) => (await ctx.storage.getUrl(storageId)) !== null,
  )
}

describe('quick bill scans', () => {
  it('count against the monthly receipt scans but never as a bill', async () => {
    vi.stubEnv('BILLING_ENABLED', 'true')
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)

    for (let index = 0; index < 5; index++) {
      await host.mutation(api.quickScan.start, {
        storageId: await storePhoto(t),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    }
    const overQuota = { data: { code: 'QUOTA_OCR' } }
    await expect(
      host.mutation(api.quickScan.generateUploadUrl, {}),
    ).rejects.toMatchObject(overQuota)
    await expect(
      host.mutation(api.quickScan.start, { storageId: await storePhoto(t) }),
    ).rejects.toMatchObject(overQuota)

    // Five Free bills are still there to make.
    for (let index = 0; index < 5; index++) {
      await host.mutation(api.bills.create, {})
    }
  })

  it('share the hourly scan cap with bill scans', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    let started = 0
    for (let index = 0; index < 25; index++) {
      try {
        await host.mutation(api.quickScan.start, {
          storageId: await storePhoto(t),
        })
        started++
      } catch {
        break
      }
    }
    expect(started).toBe(20)

    const billId = await host.mutation(api.bills.create, {})
    await host.mutation(api.bills.update, {
      billId,
      receiptStorageId: await storePhoto(t),
    })
    await expect(
      host.mutation(api.receiptScan.startScan, { billId }),
    ).rejects.toThrow()
  })

  it('delete the photo as soon as the read is over and tell the phone why it failed', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)
    const storageId = await storePhoto(t)
    const scanId = await host.mutation(api.quickScan.start, { storageId })
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
    const scanId = await host.mutation(api.quickScan.start, { storageId })
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
    const scanId = await host.mutation(api.quickScan.start, { storageId })

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
    const scanId = await host.mutation(api.quickScan.start, { storageId })

    vi.setSystemTime(Date.now() + DAY_MS + 1)
    const result = await t.mutation(internal.cleanup.run, {})

    expect(result.purgedQuickScans).toBe(1)
    expect(await host.query(api.quickScan.get, { scanId })).toBeNull()
    expect(await photoExists(t, storageId)).toBe(false)
  })
})
