// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
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
  it('deletes every receipt photo, the legacy one included', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const photos = [await storePhoto(t), await storePhoto(t)]
    for (const storageId of photos) {
      await bill.host.mutation(api.billReceipts.addReceipt, {
        billId: bill.billId,
        storageId,
      })
    }
    const legacy = await storePhoto(t)
    await t.run((ctx) =>
      ctx.db.patch(bill.billId, { receiptStorageId: legacy }),
    )

    await bill.host.mutation(api.bills.remove, { billId: bill.billId })

    expect(await receiptRows(t, bill.billId)).toEqual([])
    for (const storageId of [...photos, legacy]) {
      expect(await photoExists(t, storageId)).toBe(false)
    }
  })
})

describe('moving legacy bill photos (backfill:moveLegacyReceipts)', () => {
  it('moves each legacy photo into a receipt once and clears the old field', async () => {
    const t = setupConvex()
    const withLines = await seedBill(t)
    const empty = await seedBill(t, { items: [] })
    const lost = await seedBill(t)
    const withLinesPhoto = await storePhoto(t)
    const emptyPhoto = await storePhoto(t)
    const lostPhoto = await storePhoto(t)
    await t.run(async (ctx) => {
      await ctx.db.patch(withLines.billId, { receiptStorageId: withLinesPhoto })
      await ctx.db.patch(empty.billId, { receiptStorageId: emptyPhoto })
      await ctx.db.patch(lost.billId, { receiptStorageId: lostPhoto })
      await ctx.storage.delete(lostPhoto)
    })

    const first = await t.mutation(internal.backfill.moveLegacyReceipts, {})
    const again = await t.mutation(internal.backfill.moveLegacyReceipts, {})

    expect(first).toEqual({ moved: 2, cleared: 3 })
    expect(again).toEqual({ moved: 0, cleared: 0 })
    const bills = await t.run(async (ctx) => ({
      withLines: await ctx.db.get(withLines.billId),
      empty: await ctx.db.get(empty.billId),
      lost: await ctx.db.get(lost.billId),
    }))
    expect(bills.withLines?.receiptStorageId).toBeUndefined()
    expect(bills.empty?.receiptStorageId).toBeUndefined()
    expect(bills.lost?.receiptStorageId).toBeUndefined()

    const [moved] = await receiptRows(t, withLines.billId)
    expect(moved).toMatchObject({
      storageId: withLinesPhoto,
      createdAt: bills.withLines?.createdAt,
      importedAt: bills.withLines?.updatedAt,
    })
    const [notImported] = await receiptRows(t, empty.billId)
    expect(notImported.storageId).toBe(emptyPhoto)
    expect(notImported).not.toHaveProperty('importedAt')
    expect(await receiptRows(t, lost.billId)).toEqual([])
    // Which lines came from the photo is unknowable.
    const { items } = await withLines.host.query(api.bills.get, {
      billId: withLines.billId,
    })
    expect(items.every((item) => item.receiptId === undefined)).toBe(true)
  })

  it('does not move a photo twice when a run stopped halfway', async () => {
    const t = setupConvex()
    const bill = await seedBill(t)
    const photo = await storePhoto(t)
    await t.run(async (ctx) => {
      await ctx.db.patch(bill.billId, { receiptStorageId: photo })
      await ctx.db.insert('billReceipts', {
        billId: bill.billId,
        storageId: photo,
        createdAt: Date.now(),
      })
    })

    const result = await t.mutation(internal.backfill.moveLegacyReceipts, {})

    expect(result).toEqual({ moved: 0, cleared: 1 })
    expect(await receiptRows(t, bill.billId)).toHaveLength(1)
  })
})
