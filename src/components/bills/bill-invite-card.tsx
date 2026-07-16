import { useEffect, useRef, useState } from 'react'
import { Link2OffIcon, QrCodeIcon, Share2Icon } from 'lucide-react'
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
import { ICON } from '#/lib/app-icons.ts'
import { buildBillJoinUrl, resolveAppOrigin } from '#/lib/bill-join-url.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { shareLink } from '#/lib/share-link.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export interface BillInviteCardProps {
  billId: Id<'bills'>
  shareToken?: string
  disabled?: boolean
  readOnly?: boolean
}

export function BillInviteCard({
  billId,
  shareToken,
  disabled,
  readOnly = false,
}: BillInviteCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [joinUrl, setJoinUrl] = useState('')
  const [rotateOpen, setRotateOpen] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const rotateShareToken = useMutation(api.bills.rotateShareToken)

  useEffect(() => {
    if (!shareToken) {
      setJoinUrl('')
      return
    }
    const origin = resolveAppOrigin(window.location.origin)
    const url = buildBillJoinUrl(billId, origin, shareToken)
    setJoinUrl(url)
    if (!canvasRef.current || disabled || !origin) return

    void import('qrcode').then(({ default: QRCode }) =>
      QRCode.toCanvas(canvasRef.current!, url, {
        width: 200,
        margin: 1,
        color: { dark: '#173a40', light: '#ffffff' },
      }),
    )
  }, [billId, disabled, shareToken])

  async function handleShareLink() {
    if (!joinUrl) return
    const result = await shareLink({
      url: joinUrl,
      title: 'Онова за сметката',
    })

    if (result === 'shared') {
      toast.success('Линкът е споделен')
    } else if (result === 'copied') {
      toast.success('Линкът е копиран')
    } else if (result === 'failed') {
      toast.error('Неуспешно споделяне')
    }
  }

  async function handleRotateConfirm() {
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

  return (
    <>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-4">
        <div className="flex items-center gap-2 self-start text-sm font-medium">
          <QrCodeIcon className={ICON.section} aria-hidden />
          Покани приятели
        </div>
        {disabled ? (
          <p className="self-start text-sm text-muted-foreground">
            Добавете поне един участник, за да покажете QR код.
          </p>
        ) : !shareToken ? (
          <p className="self-start text-sm text-muted-foreground">
            Линкът за покана се подготвя...
          </p>
        ) : (
          <>
            <span data-testid="join-url" className="sr-only">
              {joinUrl}
            </span>
            <canvas
              ref={canvasRef}
              className="rounded-md border bg-white p-2"
              aria-label="QR код за присъединяване към сметката"
            />
            <p className="text-center text-xs text-muted-foreground">
              Приятелите сканират QR кода, избират името си и отбелязват какво
              са консумирали. Използвайте само с хора на масата.
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled={!joinUrl}
              onClick={() => void handleShareLink()}
            >
              <Share2Icon className={ICON.button} aria-hidden />
              Сподели линк
            </Button>
            {!readOnly ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full text-muted-foreground"
                onClick={() => setRotateOpen(true)}
              >
                <Link2OffIcon className={ICON.button} aria-hidden />
                Обнови линка
              </Button>
            ) : null}
          </>
        )}
      </div>

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
              onClick={() => void handleRotateConfirm()}
            >
              {isRotating ? 'Обновяване...' : 'Обнови линка'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
