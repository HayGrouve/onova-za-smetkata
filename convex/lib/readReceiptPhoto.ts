import type { Id } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'
import { scanReceiptImage } from './geminiReceipt'
import type { ScannedReceiptItem } from './geminiReceipt'
import {
  RECEIPT_IMAGE_MESSAGES,
  receiptImageProblem,
} from '../../shared/receipt-image'

export type ReceiptReading =
  | {
      ok: true
      restaurantName?: string
      items: ScannedReceiptItem[]
      receiptTotalCents?: number
      itemsTotalCents: number
      totalsMismatch: boolean
    }
  | { ok: false; errorMessage: string }

/**
 * Read a stored receipt photo with Gemini. Never throws: a failure comes back
 * as the message the Host sees. `onProcessing` runs once the photo passed the
 * checks that need no download, right before the call that costs money.
 */
export async function readReceiptPhoto(
  ctx: ActionCtx,
  {
    storageId,
    photo,
    onProcessing,
  }: {
    storageId: Id<'_storage'>
    photo: { size: number; contentType?: string } | null
    onProcessing: () => Promise<unknown>
  },
): Promise<ReceiptReading> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { ok: false, errorMessage: 'AI не е конфигуриран (GEMINI_API_KEY)' }
  }

  // Gemini would refuse these anyway: say why instead of spending a call.
  // The stored size is known before downloading; the type may only be
  // known from the download itself, so the check repeats below.
  const storedProblem = photo
    ? receiptImageProblem({
        size: photo.size,
        type: photo.contentType ?? 'image/jpeg',
      })
    : null
  if (storedProblem) return { ok: false, errorMessage: storedProblem }

  try {
    await onProcessing()
    const blob = await ctx.storage.get(storageId)
    if (!blob) throw new Error('Receipt image not found')
    const mimeType = blob.type || 'image/jpeg'
    const problem = receiptImageProblem({ size: blob.size, type: mimeType })
    if (problem) return { ok: false, errorMessage: problem }
    const buffer = Buffer.from(await blob.arrayBuffer())
    const base64 = buffer.toString('base64')

    const result = await scanReceiptImage(apiKey, base64, mimeType)
    const items = result.items.filter(
      (i) => i.unitPriceCents > 0 && i.name.trim().length > 0,
    )
    const itemsTotalCents = items.reduce(
      (s, i) => s + i.unitPriceCents * i.quantity,
      0,
    )
    return {
      ok: true,
      restaurantName: result.restaurantName,
      items,
      receiptTotalCents: result.receiptTotalCents,
      itemsTotalCents,
      totalsMismatch:
        result.receiptTotalCents !== undefined &&
        Math.abs(itemsTotalCents - result.receiptTotalCents) > 1,
    }
  } catch (e) {
    // The Host sees this message; the API's own error is for the logs.
    console.error('Receipt scan failed', e)
    return { ok: false, errorMessage: RECEIPT_IMAGE_MESSAGES.scanFailed }
  }
}
