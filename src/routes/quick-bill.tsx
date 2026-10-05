import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { CameraIcon } from 'lucide-react'
import { QuickBillView } from '#/components/quick-bill/quick-bill-view.tsx'
import type { QuickBillScreen } from '#/components/quick-bill/quick-bill-view.tsx'
import { QuickCameraButton } from '#/components/quick-bill/quick-camera-button.tsx'
import {
  ReceiptLoading,
  ReceiptMessage,
} from '#/components/receipt/receipt-states.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useQuickBill } from '#/hooks/use-quick-bill.ts'
import { useQuickScanResult } from '#/hooks/use-quick-scan.ts'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import { QUICK_BILL_TTL_MS } from '../../shared/quick-bill.ts'

const VIEWS = new Set<QuickBillScreen>(['seats', 'turn', 'summary'])

export const Route = createFileRoute('/quick-bill')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { view?: QuickBillScreen; seat?: string } => ({
    view: VIEWS.has(search.view as QuickBillScreen)
      ? (search.view as QuickBillScreen)
      : undefined,
    seat: typeof search.seat === 'string' ? search.seat : undefined,
  }),
  head: () => buildNoIndexHead('Бърза сметка'),
  component: QuickBillPage,
})

/** A throwaway bill on the Host's phone: snap, pass around, see totals. */
function QuickBillPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useRequireHostAuth('/quick-bill')
  const stored = useQuickBill()
  useQuickScanResult(stored)

  if (isLoading || !isAuthenticated) return <ReceiptLoading />

  if (!stored) {
    return (
      <ReceiptMessage
        title="Няма бърза сметка"
        action={
          <div className="flex flex-col gap-2">
            <QuickCameraButton
              mode="new"
              size="lg"
              onStarted={() =>
                void navigate({ to: '/quick-bill', search: {}, replace: true })
              }
            >
              <CameraIcon aria-hidden />
              Снимай бележката
            </QuickCameraButton>
            <Button asChild variant="outline">
              <Link to="/">Към началото</Link>
            </Button>
          </div>
        }
      >
        Снимате бележката, подавате телефона и всеки отбелязва своето. Нищо не
        се запазва, а оставена без промени, сметката изчезва сама след{' '}
        {QUICK_BILL_TTL_MS / 3_600_000} часа.
      </ReceiptMessage>
    )
  }

  return (
    <QuickBillView
      stored={stored}
      screen={search.view ?? 'setup'}
      seatId={search.seat}
    />
  )
}
