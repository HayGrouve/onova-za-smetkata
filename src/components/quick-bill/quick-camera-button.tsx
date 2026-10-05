import { useRef } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { useStartQuickScan } from '#/hooks/use-quick-scan.ts'

/**
 * A button that opens the camera in the same tap. Browsers only open a file
 * picker from a user gesture, so nothing is awaited before the click: the
 * upload and the read run on after `onStarted` navigates away.
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
          if (!file) return
          void startScan(file, mode)
          onStarted?.()
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
