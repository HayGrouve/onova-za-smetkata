import { useEffect, useRef, useState } from 'react'
import { LinkIcon, QrCodeIcon } from 'lucide-react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { buildBillJoinUrl, resolveAppOrigin } from '#/lib/bill-join-url.ts'
import { copyToClipboard } from '#/lib/copy-to-clipboard.ts'
import type { Id } from '../../../convex/_generated/dataModel'

export interface BillInviteCardProps {
  billId: Id<'bills'>
  disabled?: boolean
}

export function BillInviteCard({ billId, disabled }: BillInviteCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [joinUrl, setJoinUrl] = useState('')

  useEffect(() => {
    const origin = resolveAppOrigin(window.location.origin)
    const url = buildBillJoinUrl(billId, origin)
    setJoinUrl(url)
    if (!canvasRef.current || disabled || !origin) return
    void QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 1,
      color: { dark: '#173a40', light: '#ffffff' },
    })
  }, [billId, disabled])

  async function handleCopyLink() {
    if (!joinUrl) return
    const copied = await copyToClipboard(joinUrl)
    if (copied) {
      toast.success('Линкът е копиран')
      return
    }
    toast.error('Неуспешно копиране — маркирайте линка по-долу ръчно')
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2 self-start text-sm font-medium">
        <QrCodeIcon className={ICON.section} aria-hidden />
        Покани приятели
      </div>
      {disabled ? (
        <p className="self-start text-sm text-muted-foreground">
          Добавете поне един участник, за да покажете QR код.
        </p>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className="rounded-md border bg-white p-2"
            aria-label="QR код за присъединяване към сметката"
          />
          <p className="text-center text-xs text-muted-foreground">
            Приятелите сканират QR кода, избират името си и отбелязват какво са
            консумирали. Използвайте само с хора на масата.
          </p>
          {joinUrl ? (
            <Input
              readOnly
              value={joinUrl}
              aria-label="Линк за присъединяване"
              className="h-10 text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={handleCopyLink}
          >
            <LinkIcon className={ICON.button} aria-hidden />
            Копирай линк
          </Button>
        </>
      )}
    </div>
  )
}
