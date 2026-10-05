import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect } from 'react'
import { useSubscriptionPaywall } from '#/components/subscription/subscription-provider.tsx'
import { getConvexErrorMessage } from '#/lib/convex-error.ts'
import { prepareReceiptImage } from '#/lib/prepare-receipt-image.ts'
import {
  readQuickBill,
  updateQuickBill,
  writeQuickBill,
} from '#/lib/quick-bill-storage.ts'
import type {
  QuickScanState,
  StoredQuickBill,
} from '#/lib/quick-bill-storage.ts'
import { validateItemAddArgs } from '../../shared/item-schema.ts'
import {
  createQuickBill,
  replaceQuickBillLines,
} from '../../shared/quick-bill.ts'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

/**
 * The upload this page load is running. A stored „uploading“ with another
 * attempt was cut off by a reload: the photo never made it.
 */
let liveAttempt: string | null = null

export function isQuickScanUploadLive(attempt: string): boolean {
  return liveAttempt === attempt
}

/** The photo being read, to show while the lines are on their way. */
let livePhoto: { attempt: string; url: string } | null = null

export function quickScanPhotoUrl(attempt: string): string | null {
  return livePhoto?.attempt === attempt ? livePhoto.url : null
}

function showPhoto(attempt: string, blob: Blob) {
  if (livePhoto) URL.revokeObjectURL(livePhoto.url)
  livePhoto = { attempt, url: URL.createObjectURL(blob) }
}

const SCAN_GONE = 'Разпознаването прекъсна. Снимайте бележката отново.'

/** Upload plus read take seconds; after this long the read is presumed dead. */
export const QUICK_SCAN_STALE_MS = 3 * 60 * 1000

/** A photo still on its way after `QUICK_SCAN_STALE_MS`: offer a retake. */
export function isQuickScanStale(scan: QuickScanState, now: number): boolean {
  return (
    (scan.phase === 'uploading' || scan.phase === 'reading') &&
    now - scan.startedAt > QUICK_SCAN_STALE_MS
  )
}

function isAttempt(stored: StoredQuickBill | null, attempt: string) {
  return (
    (stored?.scan.phase === 'uploading' || stored?.scan.phase === 'reading') &&
    stored.scan.attempt === attempt
  )
}

/**
 * Send a receipt photo to be read for the quick bill. `new` starts a fresh
 * quick bill (the camera button on home); `retake` keeps the seats.
 * Runs on after the caller navigates away: the result lands in storage.
 */
export function useStartQuickScan() {
  const convex = useConvex()
  const { handleMutationError, openPaywall } = useSubscriptionPaywall()

  return useCallback(
    async (file: File, mode: 'new' | 'retake') => {
      const attempt = crypto.randomUUID()
      const scan = {
        phase: 'uploading' as const,
        attempt,
        startedAt: Date.now(),
      }
      if (mode === 'new') {
        writeQuickBill({ bill: createQuickBill({ now: Date.now() }), scan })
      } else {
        updateQuickBill((current) => ({ ...current, scan }))
      }
      liveAttempt = attempt

      try {
        const { blob, contentType } = await prepareReceiptImage(file)
        showPhoto(attempt, blob)
        const uploadUrl = await convex.mutation(
          api.quickScan.generateUploadUrl,
          {},
        )
        if (!isAttempt(readQuickBill(), attempt)) return
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': contentType },
          body: blob,
        })
        if (!response.ok) {
          throw new Error(`Неуспешно качване (${response.status})`)
        }
        const { storageId } = (await response.json()) as {
          storageId: Id<'_storage'>
        }
        const started = await convex.mutation(api.quickScan.start, {
          storageId,
        })
        if (!started.ok) {
          // Refused after the upload: the server already deleted the photo.
          if (!isAttempt(readQuickBill(), attempt)) return
          if (started.quota) openPaywall('QUOTA_OCR', started.message)
          updateQuickBill((current) => ({
            ...current,
            scan: { phase: 'failed', message: started.message },
          }))
          return
        }
        const { scanId } = started
        if (!isAttempt(readQuickBill(), attempt)) {
          // Closed or typed by hand meanwhile: nobody wants these lines.
          void convex.mutation(api.quickScan.discard, { scanId })
          return
        }
        updateQuickBill((current) =>
          current.scan.phase === 'uploading'
            ? {
                ...current,
                scan: { ...current.scan, phase: 'reading', scanId },
              }
            : current,
        )
      } catch (error) {
        if (!isAttempt(readQuickBill(), attempt)) return
        // Over the monthly scans: the paywall says so; the page offers typing.
        handleMutationError(error)
        updateQuickBill((current) => ({
          ...current,
          scan: { phase: 'failed', message: getConvexErrorMessage(error) },
        }))
      } finally {
        if (liveAttempt === attempt) liveAttempt = null
      }
    },
    [convex, handleMutationError, openPaywall],
  )
}

/** While the receipt is read: print its lines into the quick bill when done. */
export function useQuickScanResult(stored: StoredQuickBill | null) {
  // Convex auth, not Clerk's: before the token reaches Convex the scan reads
  // as missing, and a missing scan counts as lost.
  const { isAuthenticated } = useConvexAuth()
  const reading = stored?.scan.phase === 'reading' ? stored.scan : null
  const scan = useQuery(
    api.quickScan.get,
    isAuthenticated && reading
      ? { scanId: reading.scanId as Id<'quickScans'> }
      : 'skip',
  )
  const discard = useMutation(api.quickScan.discard)

  useEffect(() => {
    if (!reading || scan === undefined) return
    if (scan?.status === 'pending' || scan?.status === 'processing') return

    const stillThis = (current: StoredQuickBill) =>
      current.scan.phase === 'reading' && current.scan.scanId === reading.scanId

    if (scan?.status === 'done') {
      // Lines the bill editor would refuse are dropped; the total check shows it.
      const lines = scan.items.flatMap((item) => {
        const valid = validateItemAddArgs(item)
        return valid.ok ? [valid.data] : []
      })
      updateQuickBill((current) =>
        stillThis(current)
          ? {
              bill: replaceQuickBillLines(current.bill, {
                lines,
                restaurantName: scan.restaurantName,
                receiptTotalCents: scan.receiptTotalCents,
              }),
              scan: { phase: 'read' },
            }
          : current,
      )
    } else {
      updateQuickBill((current) =>
        stillThis(current)
          ? {
              ...current,
              scan: {
                phase: 'failed',
                message: scan?.errorMessage ?? SCAN_GONE,
              },
            }
          : current,
      )
    }
    if (scan) {
      void discard({ scanId: reading.scanId as Id<'quickScans'> }).catch(() => {
        // The cleanup cron sweeps it.
      })
    }
  }, [scan, reading?.scanId])
}
