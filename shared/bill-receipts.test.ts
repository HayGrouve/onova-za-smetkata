import { describe, expect, it } from 'vitest'
import {
  MAX_RECEIPTS_PER_BILL,
  chooseReceiptScanStart,
  importModeForUnrequestedScan,
  nextReceiptToScan,
  planReceiptUploads,
  receiptPosition,
  receiptsCheckTotal,
  scanningReceiptId,
  shouldUpdateRestaurantNameByDefault,
} from './bill-receipts'

const unread = (id: string) => ({ _id: id })
const imported = (id: string, receiptTotalCents?: number) => ({
  _id: id,
  importedAt: 1,
  ...(receiptTotalCents !== undefined ? { receiptTotalCents } : {}),
})

describe('nextReceiptToScan', () => {
  it('is nothing when the bill holds no receipt', () => {
    expect(nextReceiptToScan([])).toBeNull()
  })

  it('picks the oldest receipt not imported yet', () => {
    const next = nextReceiptToScan([imported('a'), unread('b'), unread('c')])
    expect(next?.receipt._id).toBe('b')
    expect(next?.othersImported).toBe(true)
  })

  it('says no other receipt is imported when none is', () => {
    const next = nextReceiptToScan([unread('a'), unread('b')])
    expect(next?.receipt._id).toBe('a')
    expect(next?.othersImported).toBe(false)
  })

  it('is nothing once every receipt is imported', () => {
    expect(nextReceiptToScan([imported('a'), imported('b')])).toBeNull()
  })
})

describe('chooseReceiptScanStart', () => {
  it('adds straight away to a bill with no lines', () => {
    expect(
      chooseReceiptScanStart({
        receipt: unread('a'),
        receipts: [unread('a')],
        lines: [],
        assignments: [],
      }),
    ).toEqual({ mode: 'add' })
  })

  it('asks add or replace when lines exist and no receipt is imported yet', () => {
    expect(
      chooseReceiptScanStart({
        receipt: unread('a'),
        receipts: [unread('a')],
        lines: [{ _id: 'typed' }],
        assignments: [],
      }),
    ).toEqual({ mode: 'ask' })
  })

  it('adds a further receipt without asking once another is imported', () => {
    expect(
      chooseReceiptScanStart({
        receipt: unread('b'),
        receipts: [imported('a'), unread('b')],
        lines: [{ _id: 'l1', receiptId: 'a' }],
        assignments: [{ itemId: 'l1' }],
      }),
    ).toEqual({ mode: 'add' })
  })

  it('replaces only that receipt’s lines when it is scanned again', () => {
    expect(
      chooseReceiptScanStart({
        receipt: imported('a'),
        receipts: [imported('a'), imported('b')],
        lines: [
          { _id: 'l1', receiptId: 'a' },
          { _id: 'l2', receiptId: 'b' },
        ],
        assignments: [{ itemId: 'l2' }],
      }),
    ).toEqual({ mode: 'replaceReceipt', confirm: false })
  })

  it('confirms first when that receipt’s lines are assigned', () => {
    expect(
      chooseReceiptScanStart({
        receipt: imported('a'),
        receipts: [imported('a')],
        lines: [{ _id: 'l1', receiptId: 'a' }, { _id: 'typed' }],
        assignments: [{ itemId: 'l1' }],
      }),
    ).toEqual({ mode: 'replaceReceipt', confirm: true })
  })

  it('asks add or replace for an imported receipt no line remembers', () => {
    // A photo moved over from before receipts were tracked per line.
    expect(
      chooseReceiptScanStart({
        receipt: imported('a'),
        receipts: [imported('a')],
        lines: [{ _id: 'old' }],
        assignments: [],
      }),
    ).toEqual({ mode: 'ask' })
  })

  it('asks for a moved-over receipt even once another receipt’s lines are tracked', () => {
    // Replacing would find none of its lines and add them a second time.
    expect(
      chooseReceiptScanStart({
        receipt: imported('a'),
        receipts: [imported('a'), imported('b')],
        lines: [{ _id: 'old' }, { _id: 'l2', receiptId: 'b' }],
        assignments: [],
      }),
    ).toEqual({ mode: 'ask' })
  })

  it('replaces the receipt’s lines when the Host removed all of them by hand', () => {
    expect(
      chooseReceiptScanStart({
        receipt: imported('a'),
        receipts: [imported('a'), imported('b')],
        lines: [{ _id: 'l2', receiptId: 'b' }],
        assignments: [],
      }),
    ).toEqual({ mode: 'replaceReceipt', confirm: false })
  })
})

describe('receiptsCheckTotal', () => {
  it('is nothing when lines from a receipt sit beside lines from none', () => {
    // E.g. a removed receipt photo left its lines: they no longer have a total.
    expect(
      receiptsCheckTotal(
        [imported('b', 800)],
        [{ receiptId: 'b' }, { receiptId: undefined }],
      ),
    ).toBeNull()
  })

  it('checks lines that all came from receipts', () => {
    expect(
      receiptsCheckTotal([imported('b', 800)], [{ receiptId: 'b' }]),
    ).toEqual({ totalCents: 800, receiptCount: 1 })
  })

  it('checks a bill whose lines remember no receipt (from before)', () => {
    expect(receiptsCheckTotal([imported('a', 800)], [{}, {}])).toEqual({
      totalCents: 800,
      receiptCount: 1,
    })
  })

  it('is nothing before any receipt is imported', () => {
    expect(receiptsCheckTotal([unread('a')], [])).toBeNull()
  })

  it('sums the printed totals of the imported receipts', () => {
    expect(
      receiptsCheckTotal(
        [imported('a', 1250), unread('b'), imported('c', 800)],
        [],
      ),
    ).toEqual({ totalCents: 2050, receiptCount: 2 })
  })

  it('is nothing when an imported receipt has no printed total', () => {
    expect(
      receiptsCheckTotal([imported('a', 1250), imported('b')], []),
    ).toBeNull()
  })

  it('is nothing when the totals add up to zero', () => {
    expect(receiptsCheckTotal([imported('a', 0)], [])).toBeNull()
  })
})

describe('planReceiptUploads', () => {
  it('uploads every picked photo that fits', () => {
    expect(planReceiptUploads(3, 2)).toEqual({ upload: 3, overflow: 0 })
  })

  it('uploads up to the cap and counts the rest', () => {
    expect(planReceiptUploads(5, MAX_RECEIPTS_PER_BILL - 2)).toEqual({
      upload: 2,
      overflow: 3,
    })
  })

  it('uploads nothing to a full bill', () => {
    expect(planReceiptUploads(1, MAX_RECEIPTS_PER_BILL)).toEqual({
      upload: 0,
      overflow: 1,
    })
  })
})

describe('scanningReceiptId', () => {
  it('is nothing while no scan runs', () => {
    expect(
      scanningReceiptId({
        isScanning: false,
        requestedReceiptId: 'a',
        latestScan: { status: 'done', receiptId: 'a' },
      }),
    ).toBeNull()
  })

  it('prefers the receipt this phone asked to read', () => {
    expect(
      scanningReceiptId({
        isScanning: true,
        requestedReceiptId: 'b',
        latestScan: { status: 'done', receiptId: 'a' },
      }),
    ).toBe('b')
  })

  it('falls back to the receipt of the scan in flight', () => {
    expect(
      scanningReceiptId({
        isScanning: true,
        requestedReceiptId: null,
        latestScan: { status: 'processing', receiptId: 'a' },
      }),
    ).toBe('a')
  })

  it('ignores a finished scan’s receipt', () => {
    expect(
      scanningReceiptId({
        isScanning: true,
        requestedReceiptId: null,
        latestScan: { status: 'failed', receiptId: 'a' },
      }),
    ).toBeNull()
  })
})

describe('receiptPosition', () => {
  it('numbers receipts from one, oldest first', () => {
    expect(
      receiptPosition([unread('a'), unread('b'), unread('c')], 'b'),
    ).toEqual({ number: 2, count: 3 })
  })

  it('is nothing for a receipt not on the bill', () => {
    expect(receiptPosition([unread('a')], 'z')).toBeNull()
    expect(receiptPosition([unread('a')], undefined)).toBeNull()
  })
})

describe('shouldUpdateRestaurantNameByDefault', () => {
  it('updates the name from the first receipt imported', () => {
    expect(
      shouldUpdateRestaurantNameByDefault([unread('a'), unread('b')], 'a'),
    ).toBe(true)
  })

  it('updates the name when the same receipt is scanned again', () => {
    expect(shouldUpdateRestaurantNameByDefault([imported('a')], 'a')).toBe(true)
  })

  it('keeps the name once another receipt is imported', () => {
    expect(
      shouldUpdateRestaurantNameByDefault([imported('a'), unread('b')], 'b'),
    ).toBe(false)
  })
})

describe('importModeForUnrequestedScan', () => {
  it('replaces the lines of a receipt already imported', () => {
    expect(importModeForUnrequestedScan([imported('a')], 'a')).toBe(
      'replaceReceipt',
    )
  })

  it('adds the lines of a receipt not imported yet', () => {
    expect(importModeForUnrequestedScan([unread('a')], 'a')).toBe('add')
    expect(importModeForUnrequestedScan([], undefined)).toBe('add')
  })
})
