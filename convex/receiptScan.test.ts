// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { HOST_IDENTITY, seedBill, setupConvex } from './test.setup'
import {
  RECEIPT_IMAGE_MAX_BYTES,
  RECEIPT_IMAGE_MESSAGES,
} from '../shared/receipt-image'
import type { TestConvex } from './test.setup'

beforeEach(() => {
  // The scheduled OCR action must never reach Gemini from a test: without a
  // key it marks the scan failed straight away.
  vi.stubEnv('GEMINI_API_KEY', '')
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

async function storeReceipt(t: TestConvex) {
  return await t.run((ctx) =>
    ctx.storage.store(new Blob(['receipt'], { type: 'image/jpeg' })),
  )
}

/** A finished scan with two read lines, as the OCR action would leave it. */
async function insertDoneScan(
  t: TestConvex,
  billId: Id<'bills'>,
  storageId: Id<'_storage'>,
) {
  return await t.run((ctx) =>
    ctx.db.insert('receiptScans', {
      billId,
      storageId,
      status: 'done',
      extractedItems: [
        {
          name: 'Шопска',
          unitPriceCents: 900,
          quantity: 1,
          confidence: 'high',
        },
        { name: 'Бира', unitPriceCents: 400, quantity: 2, confidence: 'high' },
      ],
      itemsTotalCents: 1700,
      totalsMismatch: false,
      createdAt: Date.now(),
    }),
  )
}

describe('receipt scans', () => {
  it('a Host cannot start unlimited scans by spreading them over new bills', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)

    let started = 0
    let refused = 0
    for (let index = 0; index < 4; index++) {
      const billId = await host.mutation(api.bills.create, {})
      await host.mutation(api.bills.update, {
        billId,
        receiptStorageId: await storeReceipt(t),
      })
      for (let scan = 0; scan < 8; scan++) {
        try {
          await host.mutation(api.receiptScan.startScan, { billId })
          started++
          await t.finishAllScheduledFunctions(vi.runAllTimers)
        } catch {
          refused++
        }
      }
    }

    expect(started).toBe(20)
    expect(refused).toBe(12)
  })

  it('a second tap does not start a second scan while one is running', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    await bill.host.mutation(api.bills.update, {
      billId: bill.billId,
      receiptStorageId: await storeReceipt(t),
    })

    await bill.host.mutation(api.receiptScan.startScan, { billId: bill.billId })
    await expect(
      bill.host.mutation(api.receiptScan.startScan, { billId: bill.billId }),
    ).rejects.toThrow('Бележката вече се разпознава.')
  })

  it('imports a scan once: a second tap adds nothing', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { items: [] })
    const scanId = await insertDoneScan(t, bill.billId, await storeReceipt(t))
    const importAll = () =>
      bill.host.mutation(api.receiptScan.importScannedItems, {
        scanId,
        mode: 'add',
        selectedIndexes: [0, 1],
        updateRestaurantName: false,
      })

    await importAll()
    await expect(importAll()).rejects.toThrow('Сканирането не е намерено.')

    const { items } = await bill.host.query(api.bills.get, {
      billId: bill.billId,
    })
    expect(items.map((item) => item.name)).toEqual(['Шопска', 'Бира'])
  })

  it('replacing with nothing selected leaves the lines alone', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const scanId = await insertDoneScan(t, bill.billId, await storeReceipt(t))

    await expect(
      bill.host.mutation(api.receiptScan.importScannedItems, {
        scanId,
        mode: 'replace',
        selectedIndexes: [],
        updateRestaurantName: false,
      }),
    ).rejects.toThrow('Изберете поне един артикул за импортиране.')

    const { items } = await bill.host.query(api.bills.get, {
      billId: bill.billId,
    })
    expect(items).toHaveLength(1)
  })
})

describe('reading a receipt photo', () => {
  async function scanStoredPhoto(t: TestConvex, photo: Blob) {
    const host = t.withIdentity(HOST_IDENTITY)
    const billId = await host.mutation(api.bills.create, {})
    const storageId = await t.run((ctx) => ctx.storage.store(photo))
    await host.mutation(api.bills.update, {
      billId,
      receiptStorageId: storageId,
    })
    await host.mutation(api.receiptScan.startScan, { billId })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    return await host.query(api.receiptScan.getLatestScan, { billId })
  }

  it('turns down a photo Gemini cannot take without calling it', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    const gemini = vi.fn()
    vi.stubGlobal('fetch', gemini)
    const t = setupConvex()

    const huge = await scanStoredPhoto(
      t,
      new Blob([new Uint8Array(RECEIPT_IMAGE_MAX_BYTES + 1)], {
        type: 'image/jpeg',
      }),
    )
    const drawing = await scanStoredPhoto(
      t,
      new Blob(['<svg/>'], { type: 'image/svg+xml' }),
    )

    expect(huge).toMatchObject({
      status: 'failed',
      errorMessage: RECEIPT_IMAGE_MESSAGES.tooLarge,
    })
    expect(drawing).toMatchObject({
      status: 'failed',
      errorMessage: RECEIPT_IMAGE_MESSAGES.unsupported,
    })
    expect(gemini).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('tells the Host in Bulgarian when Gemini fails, not the raw API error', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response('{"error":{"code":400}}', { status: 400 }),
      ),
    )
    const t = setupConvex()

    const scan = await scanStoredPhoto(
      t,
      new Blob(['jpeg'], { type: 'image/jpeg' }),
    )

    expect(scan).toMatchObject({
      status: 'failed',
      errorMessage: RECEIPT_IMAGE_MESSAGES.scanFailed,
    })
    vi.unstubAllGlobals()
  })
})
