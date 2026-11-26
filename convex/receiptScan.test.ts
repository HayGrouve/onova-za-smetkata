// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  HOST_IDENTITY,
  hostTakesUnits,
  seedBill,
  setupConvex,
  unitMembers,
} from './test.setup'
import { BILL_RECEIPT_MESSAGES } from '../shared/bill-receipts'
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
  options: {
    receiptId?: Id<'billReceipts'>
    names?: string[]
    receiptTotalCents?: number
  } = {},
) {
  const { receiptId, names = ['Шопска', 'Бира'], receiptTotalCents } = options
  return await t.run((ctx) =>
    ctx.db.insert('receiptScans', {
      billId,
      ...(receiptId ? { receiptId } : {}),
      storageId,
      status: 'done',
      extractedItems: names.map((name) => ({
        name,
        unitPriceCents: 400,
        quantity: 2,
        confidence: 'high' as const,
      })),
      ...(receiptTotalCents !== undefined ? { receiptTotalCents } : {}),
      itemsTotalCents: names.length * 800,
      totalsMismatch: false,
      createdAt: Date.now(),
    }),
  )
}

/** Attach a fresh photo to the bill as one more receipt. */
async function addReceipt(
  t: TestConvex,
  bill: { host: ReturnType<TestConvex['withIdentity']>; billId: Id<'bills'> },
) {
  const storageId = await storeReceipt(t)
  const receiptId = await bill.host.mutation(api.billReceipts.addReceipt, {
    billId: bill.billId,
    storageId,
  })
  return { receiptId, storageId }
}

/** Scan a receipt and import every line it read, as the review sheet does. */
async function importReceipt(
  t: TestConvex,
  bill: { host: ReturnType<TestConvex['withIdentity']>; billId: Id<'bills'> },
  receipt: { receiptId: Id<'billReceipts'>; storageId: Id<'_storage'> },
  mode: 'add' | 'replace' | 'replaceReceipt',
  names: string[],
  receiptTotalCents?: number,
) {
  const scanId = await insertDoneScan(t, bill.billId, receipt.storageId, {
    receiptId: receipt.receiptId,
    names,
    receiptTotalCents,
  })
  await bill.host.mutation(api.receiptScan.importScannedItems, {
    scanId,
    mode,
    selectedIndexes: names.map((_, index) => index),
    updateRestaurantName: false,
  })
}

async function linesOf(bill: {
  host: ReturnType<TestConvex['withIdentity']>
  billId: Id<'bills'>
}) {
  const { items } = await bill.host.query(api.bills.get, {
    billId: bill.billId,
  })
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder)
}

describe('receipt scans', () => {
  it('a Host cannot start unlimited scans by spreading them over new bills', async () => {
    const t = setupConvex()
    const host = t.withIdentity(HOST_IDENTITY)

    let started = 0
    let refused = 0
    for (let index = 0; index < 4; index++) {
      const billId = await host.mutation(api.bills.create, {})
      const { receiptId } = await addReceipt(t, { host, billId })
      for (let scan = 0; scan < 8; scan++) {
        try {
          await host.mutation(api.receiptScan.startScan, { billId, receiptId })
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
    const { receiptId } = await addReceipt(t, bill)
    const scan = () =>
      bill.host.mutation(api.receiptScan.startScan, {
        billId: bill.billId,
        receiptId,
      })

    await scan()
    await expect(scan()).rejects.toThrow('Бележката вече се разпознава.')
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
    ).rejects.toThrow('Избери поне един артикул за импортиране.')

    const { items } = await bill.host.query(api.bills.get, {
      billId: bill.billId,
    })
    expect(items).toHaveLength(1)
  })
})

describe('scanning one of several receipt photos', () => {
  it('reads the receipt the Host picked', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    await addReceipt(t, bill)
    const second = await addReceipt(t, bill)

    await bill.host.mutation(api.receiptScan.startScan, {
      billId: bill.billId,
      receiptId: second.receiptId,
    })

    expect(
      await bill.host.query(api.receiptScan.getLatestScan, {
        billId: bill.billId,
      }),
    ).toMatchObject({
      receiptId: second.receiptId,
      storageId: second.storageId,
      status: 'pending',
    })
  })

  it("never reads another bill's receipt", async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    await addReceipt(t, bill)
    const other = await seedBill(t)
    const othersReceipt = await addReceipt(t, other)

    await expect(
      bill.host.mutation(api.receiptScan.startScan, {
        billId: bill.billId,
        receiptId: othersReceipt.receiptId,
      }),
    ).rejects.toThrow(BILL_RECEIPT_MESSAGES.notFound)
  })

  it('drops the bill’s earlier scans, so a review closed unimported never comes back', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const first = await addReceipt(t, bill)
    const second = await addReceipt(t, bill)

    const leftBehind = await bill.host.mutation(api.receiptScan.startScan, {
      billId: bill.billId,
      receiptId: first.receiptId,
    })
    await t.run((ctx) => ctx.db.patch(leftBehind, { status: 'done' }))

    await bill.host.mutation(api.receiptScan.startScan, {
      billId: bill.billId,
      receiptId: second.receiptId,
    })

    expect(await t.run((ctx) => ctx.db.get(leftBehind))).toBeNull()
  })
})

describe("importing one receipt's lines", () => {
  it('adds the lines after the others and remembers the receipt and its total', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const bill = await seedBill(t)
    const receipt = await addReceipt(t, bill)

    await importReceipt(t, bill, receipt, 'add', ['Хляб', 'Мляко'], 1600)

    const lines = await linesOf(bill)
    expect(lines.map((line) => [line.name, line.receiptId])).toEqual([
      ['Бира', undefined],
      ['Хляб', receipt.receiptId],
      ['Мляко', receipt.receiptId],
    ])
    expect(await t.run((ctx) => ctx.db.get(receipt.receiptId))).toMatchObject({
      importedAt: Date.now(),
      receiptTotalCents: 1600,
    })
  })

  it("scanning a receipt again swaps only that receipt's lines and their Units", async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const shopA = await addReceipt(t, bill)
    const shopB = await addReceipt(t, bill)
    await importReceipt(t, bill, shopA, 'add', ['Хляб', 'Мляко'], 1600)
    await importReceipt(t, bill, shopB, 'add', ['Вино'], 800)
    const before = await linesOf(bill)
    const fromA = before.find((line) => line.name === 'Хляб')!
    const fromB = before.find((line) => line.name === 'Вино')!
    await hostTakesUnits(bill, fromA._id, [bill.seats['Ани']])
    await hostTakesUnits(bill, fromB._id, [bill.seats['Ани']])

    await importReceipt(t, bill, shopA, 'replaceReceipt', ['Сирене'], 800)

    const after = await linesOf(bill)
    expect(after.map((line) => [line.name, line.receiptId])).toEqual([
      ['Бира', undefined],
      ['Вино', shopB.receiptId],
      ['Сирене', shopA.receiptId],
    ])
    expect(after.at(-1)!.sortOrder).toBeGreaterThan(fromB.sortOrder)
    expect((await unitMembers(t, fromB._id)).get(0)).toEqual([
      bill.seats['Ани'],
    ])
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('itemAssignments')
          .withIndex('by_itemId', (q) => q.eq('itemId', fromA._id))
          .collect(),
      ),
    ).toEqual([])
    expect(await t.run((ctx) => ctx.db.get(shopA.receiptId))).toMatchObject({
      receiptTotalCents: 800,
    })
  })

  it('replacing every line forgets that the other receipts were imported', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const shopA = await addReceipt(t, bill)
    const shopB = await addReceipt(t, bill)
    await importReceipt(t, bill, shopA, 'add', ['Хляб'], 800)
    await importReceipt(t, bill, shopB, 'add', ['Вино'], 800)

    await importReceipt(t, bill, shopA, 'replace', ['Сирене'], 800)

    expect((await linesOf(bill)).map((line) => line.name)).toEqual(['Сирене'])
    const receiptB = await t.run((ctx) => ctx.db.get(shopB.receiptId))
    expect(receiptB).not.toHaveProperty('importedAt')
    expect(receiptB).not.toHaveProperty('receiptTotalCents')
    expect(
      (await t.run((ctx) => ctx.db.get(shopA.receiptId)))?.importedAt,
    ).toBeDefined()
  })

  it("cannot swap a receipt's lines from a scan that names no receipt", async () => {
    // Scans from before several receipts per bill, until the cleanup drops them.
    const t = setupConvex()
    const bill = await seedBill(t)
    const scanId = await insertDoneScan(t, bill.billId, await storeReceipt(t))

    await expect(
      bill.host.mutation(api.receiptScan.importScannedItems, {
        scanId,
        mode: 'replaceReceipt',
        selectedIndexes: [0],
        updateRestaurantName: false,
      }),
    ).rejects.toThrow(BILL_RECEIPT_MESSAGES.noReceiptToReplace)
    expect(await linesOf(bill)).toHaveLength(1)
  })
})

describe('reading a receipt photo', () => {
  async function scanStoredPhoto(t: TestConvex, photo: Blob) {
    const host = t.withIdentity(HOST_IDENTITY)
    const billId = await host.mutation(api.bills.create, {})
    const storageId = await t.run((ctx) => ctx.storage.store(photo))
    const receiptId = await host.mutation(api.billReceipts.addReceipt, {
      billId,
      storageId,
    })
    await host.mutation(api.receiptScan.startScan, { billId, receiptId })
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
