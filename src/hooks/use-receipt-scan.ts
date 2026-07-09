import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { prepareReceiptImage } from '#/lib/prepare-receipt-image.ts'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

export function useReceiptScan({
  billId,
  items,
  assignments,
}: {
  billId: Id<'bills'>
  items: Doc<'items'>[]
  assignments: Doc<'itemAssignments'>[]
}) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const updateBill = useMutation(api.bills.update)
  const startScan = useMutation(api.receiptScan.startScan)

  const latestScan = useQuery(api.receiptScan.getLatestScan, { billId })
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [scanRequested, setScanRequested] = useState(false)
  const [preScanDialogOpen, setPreScanDialogOpen] = useState(false)
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false)
  const [importMode, setImportMode] = useState<'add' | 'replace'>('add')
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false)
  const [activeScanId, setActiveScanId] = useState<Id<'receiptScans'> | null>(
    null,
  )
  const handledScanIdRef = useRef<Id<'receiptScans'> | null>(null)
  const erroredScanIdRef = useRef<Id<'receiptScans'> | null>(null)

  const isScanning =
    scanRequested ||
    latestScan?.status === 'pending' ||
    latestScan?.status === 'processing'

  useEffect(() => {
    if (!latestScan) return
    if (
      latestScan.status === 'done' &&
      handledScanIdRef.current !== latestScan._id
    ) {
      handledScanIdRef.current = latestScan._id
      setScanRequested(false)
      setActiveScanId(latestScan._id)
      setReviewSheetOpen(true)
    }
    if (
      latestScan.status === 'failed' &&
      erroredScanIdRef.current !== latestScan._id
    ) {
      erroredScanIdRef.current = latestScan._id
      setScanRequested(false)
      toast.error(
        latestScan.errorMessage ?? 'Неуспешно разпознаване на бележката',
      )
    }
  }, [latestScan])

  function beginScan(mode: 'add' | 'replace') {
    setImportMode(mode)
    setScanRequested(true)
    void startScan({ billId }).catch(() => {
      setScanRequested(false)
      toast.error('Неуспешно стартиране на разпознаването')
    })
  }

  function handleScanButtonClick() {
    if (items.length > 0) {
      setPreScanDialogOpen(true)
    } else {
      beginScan('add')
    }
  }

  function handlePreScanChoice(mode: 'add' | 'replace') {
    setPreScanDialogOpen(false)
    if (mode === 'replace' && assignments.length > 0) {
      setReplaceConfirmOpen(true)
      return
    }
    beginScan(mode)
  }

  function handleReplaceConfirm() {
    setReplaceConfirmOpen(false)
    beginScan('replace')
  }

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const { blob, contentType } = await prepareReceiptImage(file)
      const uploadUrl = await generateUploadUrl({ billId })
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: blob,
      })
      if (!result.ok) {
        const errorText = await result.text()
        throw new Error(errorText || `Неуспешно качване (${result.status})`)
      }
      const { storageId } = (await result.json()) as {
        storageId: Id<'_storage'>
      }
      if (!storageId) {
        throw new Error('Качването завърши без storageId')
      }
      await updateBill({ billId, receiptStorageId: storageId })
      toast.success('Снимката е качена')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Неуспешно качване на снимката.'
      toast.error(message)
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  return {
    galleryInputRef,
    cameraInputRef,
    isUploading,
    isScanning,
    handleReceiptChange,
    handleScanButtonClick,
    preScanDialogOpen,
    setPreScanDialogOpen,
    replaceConfirmOpen,
    setReplaceConfirmOpen,
    handlePreScanChoice,
    handleReplaceConfirm,
    reviewSheetOpen,
    setReviewSheetOpen,
    activeScanId,
    importMode,
  }
}
