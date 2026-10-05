import { useRef } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useStartQuickScan } from '#/hooks/use-quick-scan.ts'
import { getQuickBillReplaceCopy } from '#/lib/destructive-action-copy.ts'
import { readQuickBill } from '#/lib/quick-bill-storage.ts'
import { isQuickBillUnderway } from '../../../shared/quick-bill.ts'

/**
 * A button that opens the camera in the same tap. Browsers only open a file
 * picker from a user gesture, so nothing is awaited before the click: the
 * upload and the read run on after `onStarted` navigates away. Replacing a
 * quick bill people already marked on is confirmed once the photo is taken.
 */
export function QuickCameraButton({
  mode,
  camera = true,
  onStarted,
  children,
  ...buttonProps
}: {
  mode: 'new' | 'retake'
  /** False picks from the gallery instead of opening the camera. */
  camera?: boolean
  onStarted?: () => void
  children: ReactNode
} & Omit<ComponentProps<typeof Button>, 'onClick' | 'children' | 'type'>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const startScan = useStartQuickScan()
  const { confirm } = useConfirmAction()

  async function begin(file: File) {
    const current = readQuickBill()
    if (
      mode === 'new' &&
      current &&
      isQuickBillUnderway(current.bill) &&
      !(await confirm(getQuickBillReplaceCopy()))
    ) {
      return
    }
    void startScan(file, mode)
    onStarted?.()
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture={camera ? 'environment' : undefined}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void begin(file)
        }}
      />
      <Button
        type="button"
        {...buttonProps}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </Button>
    </>
  )
}
