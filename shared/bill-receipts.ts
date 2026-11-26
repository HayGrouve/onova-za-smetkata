/** Receipt photos one bill may hold (e.g. a few shops for one party). */
export const MAX_RECEIPTS_PER_BILL = 10

export const BILL_RECEIPT_MESSAGES = {
  tooMany: `Може да прикачиш до ${MAX_RECEIPTS_PER_BILL} бележки към една сметка.`,
  notFound: 'Бележката не е намерена.',
  noReceiptToReplace: 'Сканирането не е от прикачена бележка.',
} as const

/** What the Host's phone knows of a receipt photo on the bill. */
export interface ReceiptState {
  _id: string
  /** Set once this receipt's lines are imported. */
  importedAt?: number
  /** The total printed on the receipt, from the scan last imported. */
  receiptTotalCents?: number
}

function isImported(receipt: ReceiptState): boolean {
  return receipt.importedAt !== undefined
}

/**
 * The receipt the main scan button reads: the oldest one whose lines are not
 * imported yet. Null once every receipt is imported (or there is none).
 */
export function nextReceiptToScan<T extends ReceiptState>(
  receipts: readonly T[],
): { receipt: T; othersImported: boolean } | null {
  const receipt = receipts.find((r) => !isImported(r))
  if (!receipt) return null
  return { receipt, othersImported: receipts.some(isImported) }
}

export type ReceiptScanStart =
  /** Append the read lines. */
  | { mode: 'add' }
  /** Swap only this receipt's lines; confirm first when some are assigned. */
  | { mode: 'replaceReceipt'; confirm: boolean }
  /** Ask the Host whether to add to the lines on the bill or replace them. */
  | { mode: 'ask' }

/**
 * How a scan of `receipt` should land on the bill. Scanning an imported
 * receipt again swaps its own lines; the first receipt read onto a bill that
 * already has lines asks; any further receipt just adds.
 */
export function chooseReceiptScanStart(input: {
  receipt: ReceiptState
  receipts: readonly ReceiptState[]
  lines: ReadonlyArray<{ _id: string; receiptId?: string }>
  assignments: ReadonlyArray<{ itemId: string }>
}): ReceiptScanStart {
  const { receipt, receipts, lines, assignments } = input
  if (isImported(receipt)) {
    const own = lines.filter((line) => line.receiptId === receipt._id)
    // A photo from before lines remembered their receipt: which lines are its
    // own is unknown, so the Host chooses as with a single receipt.
    if (
      own.length === 0 &&
      lines.length > 0 &&
      lines.every((line) => line.receiptId === undefined)
    ) {
      return { mode: 'ask' }
    }
    const ownIds = new Set(own.map((line) => line._id))
    return {
      mode: 'replaceReceipt',
      confirm: assignments.some((a) => ownIds.has(a.itemId)),
    }
  }
  if (lines.length > 0 && !receipts.some(isImported)) return { mode: 'ask' }
  return { mode: 'add' }
}

/**
 * The total printed on the imported receipts, to check the lines against.
 * Null until a receipt is imported, when one of them has no printed total, or
 * when the totals come to nothing.
 */
export function receiptsCheckTotal(
  receipts: readonly ReceiptState[],
): { totalCents: number; receiptCount: number } | null {
  const done = receipts.filter(isImported)
  if (done.length === 0) return null
  let totalCents = 0
  for (const receipt of done) {
    if (receipt.receiptTotalCents === undefined) return null
    totalCents += receipt.receiptTotalCents
  }
  if (totalCents <= 0) return null
  return { totalCents, receiptCount: done.length }
}

/** How many of the picked photos fit under the cap, and how many do not. */
export function planReceiptUploads(
  pickedCount: number,
  heldCount: number,
): { upload: number; overflow: number } {
  const room = Math.max(0, MAX_RECEIPTS_PER_BILL - heldCount)
  const upload = Math.min(pickedCount, room)
  return { upload, overflow: pickedCount - upload }
}

/**
 * The receipt being read right now: the one this phone asked for, else the
 * receipt of the scan in flight (e.g. after a reload).
 */
export function scanningReceiptId(input: {
  isScanning: boolean
  requestedReceiptId: string | null
  latestScan:
    | {
        status: 'pending' | 'processing' | 'done' | 'failed'
        receiptId?: string
      }
    | null
    | undefined
}): string | null {
  if (!input.isScanning) return null
  if (input.requestedReceiptId) return input.requestedReceiptId
  const scan = input.latestScan
  if (scan && (scan.status === 'pending' || scan.status === 'processing')) {
    return scan.receiptId ?? null
  }
  return null
}

/** „Бележка 2 от 3“: the receipt's place on the bill, oldest first. */
export function receiptPosition(
  receipts: readonly ReceiptState[],
  receiptId: string | undefined,
): { number: number; count: number } | null {
  if (receiptId === undefined) return null
  const index = receipts.findIndex((r) => r._id === receiptId)
  if (index === -1) return null
  return { number: index + 1, count: receipts.length }
}

/**
 * Whether the scan review offers to rename the bill by default: only while no
 * other receipt is imported. Several shops should not overwrite the name.
 */
export function shouldUpdateRestaurantNameByDefault(
  receipts: readonly ReceiptState[],
  receiptId: string | undefined,
): boolean {
  return !receipts.some((r) => r._id !== receiptId && isImported(r))
}

/**
 * The import mode for a finished scan this phone did not start (a reload, or
 * another tab): its receipt's lines are swapped when already imported.
 */
export function importModeForUnrequestedScan(
  receipts: readonly ReceiptState[],
  receiptId: string | undefined,
): 'add' | 'replaceReceipt' {
  const receipt = receipts.find((r) => r._id === receiptId)
  return receipt && isImported(receipt) ? 'replaceReceipt' : 'add'
}
