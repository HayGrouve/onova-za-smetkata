import { useEffect, useRef, useState } from 'react'
import { QrCodeIcon, Share2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { buildBillJoinUrl, resolveAppOrigin } from '#/lib/bill-join-url.ts'
import { shareLink } from '#/lib/share-link.ts'
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

    void import('qrcode').then(({ default: QRCode }) =>
      QRCode.toCanvas(canvasRef.current!, url, {
        width: 200,
        margin: 1,
        color: { dark: '#173a40', light: '#ffffff' },
      }),
    )
  }, [billId, disabled])

  async function handleShareLink() {
    if (!joinUrl) return
    const result = await shareLink({
      url: joinUrl,
      title: 'Онова за сметката',
      text: 'Присъедини се към сметката и отбележи какво си консумирал.',
    })

    if (result === 'shared') {
      toast.success('Линкът е споделен')
    } else if (result === 'copied') {
      toast.success('Линкът е копиран')
    } else if (result === 'failed') {
      toast.error('Неуспешно споделяне')
    }
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
        </>
      )}
    </div>
  )
}
