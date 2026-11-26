// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { GUEST_FLOW_MESSAGES } from '../shared/guest-flow-messages'
import {
  BILL_RECEIPT_MESSAGES,
  MAX_RECEIPTS_PER_BILL,
} from '../shared/bill-receipts'
import { seedBill, setBillStatus, setupConvex } from './test.setup'
import type { TestConvex } from './test.setup'

const STRANGER = { subject: 'user_stranger' }
const MINUTE_MS = 60 * 1000

beforeEach(() => {
  // A scheduled OCR action must never reach Gemini from a test.
  vi.stubEnv('GEMINI_API_KEY', '')
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

async function receiptRows(t: TestConvex, billId: Id<'bills'>) {
  return await t.run((ctx) =>
    ctx.db
      .query('billReceipts')
      .withIndex('by_billId', (q) => q.eq('billId', billId))
      .collect(),
  )
}

describe('adding a receipt photo', () => {
  it('attaches several photos to one bill, oldest first, each with its own link', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const first = await storePhoto(t)
    const second = await storePhoto(t)

    const firstId = await bill.host.mutation(api.billReceipts.addReceipt, {
      billId: bill.billId,
      storageId: first,
    })
    const secondId = await bill.host.mutation(api.billReceipts.addReceipt, {
      billId: bill.billId,
      storageId: second,
    })

    const listed = await bill.host.query(api.billReceipts.listReceipts, {
      billId: bill.billId,
    })
    expect(listed.map((receipt) => receipt._id)).toEqual([firstId, secondId])
    expect(listed.map((receipt) => receipt.url)).toEqual([
      await t.run((ctx) => ctx.storage.getUrl(first)),
      await t.run((ctx) => ctx.storage.getUrl(second)),
    ])
    expect(listed[0]).not.toHaveProperty('importedAt')
  })

  it('only the Host of a draft bill may add, list or remove its receipts', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const stranger = t.withIdentity(STRANGER)
    const receiptId = await bill.host.mutation(api.billReceipts.addReceipt, {
      billId: bill.billId,
      storageId: await storePhoto(t),
    })

    await expect(
      stranger.mutation(api.billReceipts.addReceipt, {
        billId: bill.billId,
        storageId: await storePhoto(t),
      }),
    ).rejects.toThrow()
    await expect(
      stranger.query(api.billReceipts.listReceipts, { billId: bill.billId }),
    ).rejects.toThrow()
    await expect(
      stranger.mutation(api.billReceipts.removeReceipt, { receiptId }),
    ).rejects.toThrow()

    await setBillStatus(t, bill.billId, 'final')
    await expect(
      bill.host.mutation(api.billReceipts.addReceipt, {
        billId: bill.billId,
        storageId: await storePhoto(t),
      }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.billFinalNoEdit)
    await expect(
      bill.host.mutation(api.billReceipts.removeReceipt, { receiptId }),
    ).rejects.toThrow(GUEST_FLOW_MESSAGES.billFinalNoEdit)

    expect(await receiptRows(t, bill.billId)).toHaveLength(1)
  })

  it('takes only a fresh upload no other bill holds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setupConvex()
    const owner = await seedBill(t)
    const photo = await storePhoto(t)
    await owner.host.mutation(api.billReceipts.addReceipt, {
      billId: owner.billId,
      storageId: photo,
    })

    const strangersBill = await seedBill(t, { hostIdentity: STRANGER })
    await expect(
      strangersBill.host.mutation(api.billReceipts.addReceipt, {
        billId: strangersBill.billId,
        storageId: photo,
      }),
    ).rejects.toThrow()

    const old = await storePhoto(t)
    vi.setSystemTime(Date.now() + 11 * MINUTE_MS)
    await expect(
      owner.host.mutation(api.billReceipts.addReceipt, {
        billId: owner.billId,
        storageId: old,
      }),
    ).rejects.toThrow()

    expect(await receiptRows(t, strangersBill.billId)).toEqual([])
    expect(
      (await receiptRows(t, owner.billId)).map((row) => row.storageId),
    ).toEqual([photo])
  })

  it('never takes a photo a quick scan is reading, or one already gone', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const bill = await seedBill(t)
    const reading = await storePhoto(t)
    const started = await bill.host.mutation(api.quickScan.start, {
      storageId: reading,
    })
    expect(started.ok).toBe(true)
    await expect(
      bill.host.mutation(api.billReceipts.addReceipt, {
        billId: bill.billId,
        storageId: reading,
      }),
    ).rejects.toThrow()

    const gone = await storePhoto(t)
    await t.run((ctx) => ctx.storage.delete(gone))
    await expect(
      bill.host.mutation(api.billReceipts.addReceipt, {
        billId: bill.billId,
        storageId: gone,
      }),
    ).rejects.toThrow()

    expect(await receiptRows(t, bill.billId)).toEqual([])
  })

  it(`stops at ${MAX_RECEIPTS_PER_BILL} photos per bill`, async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    for (let index = 0; index < MAX_RECEIPTS_PER_BILL; index++) {
      await bill.host.mutation(api.billReceipts.addReceipt, {
        billId: bill.billId,
        storageId: await storePhoto(t),
      })
    }

    await expect(
      bill.host.mutation(api.billReceipts.addReceipt, {
        billId: bill.billId,
        storageId: await storePhoto(t),
      }),
    ).rejects.toThrow(BILL_RECEIPT_MESSAGES.tooMany)
    expect(await receiptRows(t, bill.billId)).toHaveLength(
      MAX_RECEIPTS_PER_BILL,
    )
  })
})

describe('removing a receipt photo', () => {
  it('deletes the photo and its scans but keeps its lines as typed in', async () => {
    const t = setupConvex()
    const bill = await seedBill(t, { items: [] })
    const photo = await storePhoto(t)
    const receiptId = await bill.host.mutation(api.billReceipts.addReceipt, {
      billId: bill.billId,
      storageId: photo,
    })
    const scanId = await t.run((ctx) =>
      ctx.db.insert('receiptScans', {
        billId: bill.billId,
        receiptId,
        storageId: photo,
        status: 'done',
        extractedItems: [
          {
            name: 'Хляб',
            unitPriceCents: 200,
            quantity: 1,
            confidence: 'high',
          },
        ],
        createdAt: Date.now(),
      }),
    )
    await bill.host.mutation(api.receiptScan.importScannedItems, {
      scanId,
      mode: 'add',
      selectedIndexes: [0],
      updateRestaurantName: false,
    })
    // A later scan of the same photo, not imported yet.
    await t.run((ctx) =>
      ctx.db.insert('receiptScans', {
        billId: bill.billId,
        receiptId,
        storageId: photo,
        status: 'done',
        createdAt: Date.now(),
      }),
    )

    await bill.host.mutation(api.billReceipts.removeReceipt, { receiptId })

    expect(await receiptRows(t, bill.billId)).toEqual([])
    expect(await photoExists(t, photo)).toBe(false)
    expect(
      await bill.host.query(api.receiptScan.getLatestScan, {
        billId: bill.billId,
      }),
    ).toBeNull()
    const { items } = await bill.host.query(api.bills.get, {
      billId: bill.billId,
    })
    expect(items.map((item) => item.name)).toEqual(['Хляб'])
    expect(items[0]).not.toHaveProperty('receiptId')

    // A second tap finds nothing and is fine.
    await expect(
      bill.host.mutation(api.billReceipts.removeReceipt, { receiptId }),
    ).resolves.toBeNull()
  })

  it('leaves nothing for a scan still running on it to write to', async () => {
    vi.useFakeTimers()
    const t = setupConvex()
    const bill = await seedBill(t)
    const receiptId = await bill.host.mutation(api.billReceipts.addReceipt, {
      billId: bill.billId,
      storageId: await storePhoto(t),
    })
    await bill.host.mutation(api.receiptScan.startScan, {
      billId: bill.billId,
      receiptId,
    })

    await bill.host.mutation(api.billReceipts.removeReceipt, { receiptId })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(
      await t.run((ctx) => ctx.db.query('receiptScans').collect()),
    ).toEqual([])
  })
})

describe('deleting a bill with receipt photos', () => {
  it('deletes every receipt photo', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const photos = [await storePhoto(t), await storePhoto(t)]
    for (const storageId of photos) {
      await bill.host.mutation(api.billReceipts.addReceipt, {
        billId: bill.billId,
        storageId,
      })
    }

    await bill.host.mutation(api.bills.remove, { billId: bill.billId })

    expect(await receiptRows(t, bill.billId)).toEqual([])
    for (const storageId of photos) {
      expect(await photoExists(t, storageId)).toBe(false)
    }
  })

  it("never takes another bill's photo with it", async () => {
    const t = setupConvex()
    const owner = await seedBill(t)
    const photo = await storePhoto(t)
    await owner.host.mutation(api.billReceipts.addReceipt, {
      billId: owner.billId,
      storageId: photo,
    })
    const stranger = await seedBill(t, { hostIdentity: STRANGER })
    await expect(
      stranger.host.mutation(api.billReceipts.addReceipt, {
        billId: stranger.billId,
        storageId: photo,
      }),
    ).rejects.toThrow()

    await stranger.host.mutation(api.bills.remove, { billId: stranger.billId })

    expect(
      (await receiptRows(t, owner.billId)).map((row) => row.storageId),
    ).toEqual([photo])
    expect(await photoExists(t, photo)).toBe(true)
  })
})
