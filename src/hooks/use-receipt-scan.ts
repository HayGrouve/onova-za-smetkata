import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { useSubscriptionPaywall } from '#/components/subscription/subscription-provider.tsx'
import {
  getConvexErrorData,
  getConvexErrorMessage,
} from '#/lib/convex-error.ts'
import {
  getReceiptRemoveCopy,
  getReceiptRescanCopy,
  getScanReplaceAllCopy,
} from '#/lib/destructive-action-copy.ts'
import { prepareReceiptImage } from '#/lib/prepare-receipt-image.ts'
import { uploadReceiptPhoto } from '#/lib/upload-receipt-photo.ts'
import {
  BILL_RECEIPT_MESSAGES,
  MAX_RECEIPTS_PER_BILL,
  chooseReceiptScanStart,
  importModeForUnrequestedScan,
  nextReceiptToScan,
  planReceiptUploads,
  receiptPosition,
  scanningReceiptId,
  shouldUpdateRestaurantNameByDefault,
} from '../../shared/bill-receipts.ts'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

export type ScanImportMode = 'add' | 'replace' | 'replaceReceipt'

export type BillReceipt = FunctionReturnType<
  typeof api.billReceipts.listReceipts
>[number]

const NO_RECEIPTS: BillReceipt[] = []

function uploadedCopy(count: number): string {
  return count === 1 ? 'Снимката е качена' : `Качени са ${count} снимки`
}

function overflowCopy(count: number): string {
  const left =
    count === 1 ? 'Една снимка не се събра.' : `${count} снимки не се събраха.`
  return `${left} ${BILL_RECEIPT_MESSAGES.tooMany}`
}

export function useReceiptScan({
  billId,
  items,
  assignments,
  onReceiptUploaded,
  onLastReceiptRemoved,
}: {
  billId: Id<'bills'>
  items: Doc<'items'>[]
  assignments: Doc<'itemAssignments'>[]
  /** Fires once per batch of photos with at least one uploaded. */
  onReceiptUploaded?: () => void
  onLastReceiptRemoved?: () => void
}) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const addReceipt = useMutation(api.billReceipts.addReceipt)
  const removeReceipt = useMutation(api.billReceipts.removeReceipt)
  const startScan = useMutation(api.receiptScan.startScan)
  const { handleMutationError } = useSubscriptionPaywall()
  const { confirm } = useConfirmAction()

  const listedReceipts = useQuery(api.billReceipts.listReceipts, { billId })
  const receipts = listedReceipts ?? NO_RECEIPTS
  const latestScan = useQuery(api.receiptScan.getLatestScan, { billId })
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [scanRequested, setScanRequested] = useState(false)
  const [requestedReceiptId, setRequestedReceiptId] =
    useState<Id<'billReceipts'> | null>(null)
  const [preScanDialogOpen, setPreScanDialogOpen] = useState(false)
  const [preScanReceiptId, setPreScanReceiptId] =
    useState<Id<'billReceipts'> | null>(null)
  const [importMode, setImportMode] = useState<ScanImportMode>('add')
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false)
  const [activeScanId, setActiveScanId] = useState<Id<'receiptScans'> | null>(
    null,
  )
  const handledScanIdRef = useRef<Id<'receiptScans'> | null>(null)
  const erroredScanIdRef = useRef<Id<'receiptScans'> | null>(null)
  /** Set while the add/replace choice is being acted on (double taps). */
  const choosingRef = useRef(false)
  /** The receipt and mode this phone asked to read, until its scan lands. */
  const requestRef = useRef<{
    receiptId: Id<'billReceipts'>
    mode: ScanImportMode
  } | null>(null)

  const isScanning =
    scanRequested ||
    latestScan?.status === 'pending' ||
    latestScan?.status === 'processing'

  function clearRequest() {
    requestRef.current = null
    setScanRequested(false)
    setRequestedReceiptId(null)
  }

  useEffect(() => {
    if (!latestScan) return
    if (
      latestScan.status === 'done' &&
      handledScanIdRef.current !== latestScan._id
    ) {
      // The import mode of a scan this phone did not start depends on
      // whether its receipt is imported: wait for the list.
      if (listedReceipts === undefined) return
      handledScanIdRef.current = latestScan._id
      const request = requestRef.current
      const receipt = listedReceipts.find((r) => r._id === latestScan.receiptId)
      if (
        !request &&
        receipt?.importedAt !== undefined &&
        receipt.importedAt > latestScan.createdAt
      ) {
        // Read before the receipt's last import: nothing new to review.
        return
      }
      setImportMode(
        request && request.receiptId === latestScan.receiptId
          ? request.mode
          : importModeForUnrequestedScan(listedReceipts, latestScan.receiptId),
      )
      clearRequest()
      setActiveScanId(latestScan._id)
      setReviewSheetOpen(true)
    }
    if (
      latestScan.status === 'failed' &&
      erroredScanIdRef.current !== latestScan._id
    ) {
      erroredScanIdRef.current = latestScan._id
      clearRequest()
      toast.error(
        latestScan.errorMessage ?? 'Неуспешно разпознаване на бележката',
      )
    }
  }, [latestScan, listedReceipts])

  const isOcrBusy = isUploading || isScanning

  function beginScan(receiptId: Id<'billReceipts'>, mode: ScanImportMode) {
    // A second tap before the first scan lands must not start (and, once
    // refused, clear) the request that carries the Host's chosen mode.
    if (requestRef.current) return
    const request = { receiptId, mode }
    requestRef.current = request
    setImportMode(mode)
    setRequestedReceiptId(receiptId)
    setScanRequested(true)
    void startScan({ billId, receiptId }).catch((error: unknown) => {
      if (requestRef.current === request) clearRequest()
      if (!handleMutationError(error)) {
        toast.error(
          getConvexErrorData(error) ?? 'Неуспешно стартиране на разпознаването',
        )
      }
    })
  }

  /** Read one receipt: asks or confirms first when the bill calls for it. */
  async function scanReceipt(receiptId: Id<'billReceipts'>) {
    if (isOcrBusy) return
    const receipt = receipts.find((r) => r._id === receiptId)
    if (!receipt) return
    const start = chooseReceiptScanStart({
      receipt,
      receipts,
      lines: items,
      assignments,
    })
    if (start.mode === 'ask') {
      setPreScanReceiptId(receiptId)
      setPreScanDialogOpen(true)
      return
    }
    if (start.mode === 'replaceReceipt' && start.confirm) {
      if (!(await confirm(getReceiptRescanCopy()))) return
    }
    beginScan(receiptId, start.mode)
  }

  const nextScan = nextReceiptToScan(receipts)

  function handleScanButtonClick() {
    if (nextScan) void scanReceipt(nextScan.receipt._id)
  }

  async function handlePreScanChoice(mode: 'add' | 'replace') {
    setPreScanDialogOpen(false)
    const receiptId = preScanReceiptId
    if (!receiptId || choosingRef.current) return
    choosingRef.current = true
    setPreScanReceiptId(null)
    try {
      if (mode === 'replace' && assignments.length > 0) {
        if (!(await confirm(getScanReplaceAllCopy()))) return
      }
      beginScan(receiptId, mode)
    } finally {
      choosingRef.current = false
    }
  }

  /**
   * Confirm, then take the photo off the bill. `onConfirmed` runs before the
   * removal (e.g. to close the viewer while its tile still exists). True once
   * the photo is gone.
   */
  async function removeReceiptPhoto(
    receiptId: Id<'billReceipts'>,
    onConfirmed?: () => void,
  ): Promise<boolean> {
    if (!(await confirm(getReceiptRemoveCopy()))) return false
    onConfirmed?.()
    const wasLast = receipts.length === 1 && receipts[0]._id === receiptId
    try {
      await removeReceipt({ receiptId })
      toast.success('Снимката е премахната')
      if (wasLast) onLastReceiptRemoved?.()
      return true
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
      return false
    }
  }

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const files = Array.from(input.files ?? [])
    if (files.length === 0) return
    const plan = planReceiptUploads(files.length, receipts.length)
    if (plan.upload === 0) {
      toast.error(BILL_RECEIPT_MESSAGES.tooMany)
      input.value = ''
      return
    }
    setIsUploading(true)
    let uploaded = 0
    let failed = false
    try {
      // One by one, so a failure keeps what already went up.
      for (const file of files.slice(0, plan.upload)) {
        const { blob, contentType } = await prepareReceiptImage(file)
        const uploadUrl = await generateUploadUrl({ billId })
        const storageId = await uploadReceiptPhoto(uploadUrl, blob, contentType)
        await addReceipt({ billId, storageId })
        uploaded++
      }
    } catch (error) {
      failed = true
      toast.error(getConvexErrorMessage(error))
    } finally {
      setIsUploading(false)
      input.value = ''
    }
    if (uploaded > 0) {
      toast.success(uploadedCopy(uploaded))
      onReceiptUploaded?.()
    }
    if (!failed && plan.overflow > 0) toast.error(overflowCopy(plan.overflow))
  }

  const completedScan = latestScan?.status === 'done' ? latestScan : undefined
  const reviewReceiptId = completedScan?.receiptId

  return {
    galleryInputRef,
    cameraInputRef,
    receipts,
    /** Until the list loads, the bill may well have photos: offer no upload. */
    receiptsLoading: listedReceipts === undefined,
    canAddReceipt: receipts.length < MAX_RECEIPTS_PER_BILL,
    nextScan,
    scanningReceiptId: scanningReceiptId({
      isScanning,
      requestedReceiptId,
      latestScan,
    }),
    isUploading,
    isScanning,
    isOcrBusy,
    completedScan,
    handleReceiptChange,
    handleScanButtonClick,
    scanReceipt,
    removeReceiptPhoto,
    preScanDialogOpen,
    setPreScanDialogOpen,
    handlePreScanChoice,
    reviewSheetOpen,
    setReviewSheetOpen,
    activeScanId,
    importMode,
    reviewReceiptPosition: receiptPosition(receipts, reviewReceiptId),
    reviewUpdatesRestaurantByDefault: shouldUpdateRestaurantNameByDefault(
      receipts,
      reviewReceiptId,
    ),
  }
}
