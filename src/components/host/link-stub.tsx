import { useEffect, useRef, useState } from 'react'
import { Link2Icon, Link2OffIcon, QrCodeIcon, Share2Icon } from 'lucide-react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { buildBillJoinUrl, resolveAppOrigin } from '#/lib/bill-join-url.ts'
import { getConvexErrorMessage } from '#/lib/convex-error.ts'
import { GuidanceTarget } from '#/lib/guidance-focus/guidance-target.tsx'
import type { GuidanceFocusHandle } from '#/lib/guidance-focus/use-guidance-focus.ts'
import { shareLink } from '#/lib/share-link.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

/**
 * A ticket stub on the receipt header: the join link, share, and a QR code
 * for the people at the table.
 */
export function LinkStub({
  billId,
  shareToken,
  readOnly,
  onShareLink,
  shareGuidance,
}: {
  billId: Id<'bills'>
  shareToken?: string
  readOnly: boolean
  /** Handles sharing instead (onboarding payment checkpoint). */
  onShareLink?: (joinUrl: string) => Promise<boolean>
  shareGuidance?: GuidanceFocusHandle
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [joinUrl, setJoinUrl] = useState('')
  const [qrOpen, setQrOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const rotateShareToken = useMutation(api.bills.rotateShareToken)

  useEffect(() => {
    if (!shareToken) {
      setJoinUrl('')
      return
    }
    setJoinUrl(
      buildBillJoinUrl(
        billId,
        resolveAppOrigin(window.location.origin),
        shareToken,
      ),
    )
  }, [billId, shareToken])

  useEffect(() => {
    if (!qrOpen || !joinUrl) return
    // The canvas mounts with the dialog; draw once it and the chunk are there.
    let cancelled = false
    const frame = window.requestAnimationFrame(() => {
      import('qrcode')
        .then(({ default: QRCode }) => {
          const canvas = canvasRef.current
          if (cancelled || !canvas) return
          return QRCode.toCanvas(canvas, joinUrl, {
            width: 220,
            margin: 1,
            color: { dark: '#1d2430', light: '#fbfaf7' },
          })
        })
        .catch(() => {
          if (!cancelled) toast.error('QR кодът не се зареди')
        })
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [qrOpen, joinUrl])

  async function handleShare() {
    if (!joinUrl) return
    if (onShareLink) {
      await onShareLink(joinUrl)
      return
    }
    const result = await shareLink({ url: joinUrl, title: 'Онова за сметката' })
    if (result === 'shared') toast.success('Линкът е споделен')
    else if (result === 'copied') toast.success('Линкът е копиран')
    else if (result === 'failed') toast.error('Неуспешно споделяне')
  }

  async function handleRotate() {
    setIsRotating(true)
    try {
      await rotateShareToken({ billId })
      setRotateOpen(false)
      toast.success('Линкът е обновен')
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setIsRotating(false)
    }
  }

  const display = joinUrl.replace(/^https?:\/\//, '')
  const shareButton = (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      disabled={!joinUrl}
      onClick={() => void handleShare()}
      aria-label="Сподели линка"
    >
      <Share2Icon className="size-4" strokeWidth={1.75} aria-hidden />
    </Button>
  )

  return (
    <>
      <div className="mt-3 flex items-center gap-2 border-2 border-dashed border-rule py-1.5 pr-1.5 pl-3">
        <Link2Icon
          className="size-4 shrink-0 text-ink-muted"
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-[12px]">
          {joinUrl ? display : 'Линкът се подготвя...'}
        </span>
        <span data-testid="join-url" className="sr-only">
          {joinUrl}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!joinUrl}
          onClick={() => setQrOpen(true)}
          aria-label="Покажи QR код"
        >
          <QrCodeIcon className="size-4" strokeWidth={1.75} aria-hidden />
        </Button>
        {shareGuidance ? (
          <GuidanceTarget stepId="share" focus={shareGuidance}>
            {shareButton}
          </GuidanceTarget>
        ) : (
          shareButton
        )}
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Покажете на масата</DialogTitle>
            <DialogDescription>
              Хората сканират кода, избират името си и отбелязват какво са яли.
              Само за хората на масата.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="border-2 border-dashed border-rule p-2"
              aria-label="QR код за присъединяване към сметката"
            />
          </div>
          {!readOnly ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQrOpen(false)
                setRotateOpen(true)
              }}
            >
              <Link2OffIcon className="size-4" strokeWidth={1.75} aria-hidden />
              Обнови линка
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Обнови линка за покана?</DialogTitle>
            <DialogDescription>
              Старите линкове и QR кодове ще спрат да работят. Споделете новия
              линк с хората на масата.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isRotating}
              onClick={() => setRotateOpen(false)}
            >
              Отказ
            </Button>
            <Button
              type="button"
              disabled={isRotating}
              onClick={() => void handleRotate()}
            >
              {isRotating ? 'Обновяване...' : 'Обнови линка'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
