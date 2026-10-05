import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { QuickSeats } from '#/components/quick-bill/quick-seats.tsx'
import { QuickSetup } from '#/components/quick-bill/quick-setup.tsx'
import { QuickSummary } from '#/components/quick-bill/quick-summary.tsx'
import { QuickTurn } from '#/components/quick-bill/quick-turn.tsx'
import { FlightLayer } from '#/components/receipt/flight.tsx'
import { SeatsProvider } from '#/components/receipt/seats.tsx'
import { getQuickBillCloseCopy } from '#/lib/destructive-action-copy.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { editQuickBill, writeQuickBill } from '#/lib/quick-bill-storage.ts'
import type { StoredQuickBill } from '#/lib/quick-bill-storage.ts'
import {
  markQuickBillSeatDone,
  quickBillSeatLabel,
} from '../../../shared/quick-bill.ts'

export type QuickBillScreen = 'setup' | 'seats' | 'turn' | 'summary'

/**
 * The quick bill on the Host's phone: set up → „Чий ред е?“ → each turn →
 * summary. Screens are search params so the phone's Back button works.
 */
export function QuickBillView({
  stored,
  screen,
  seatId,
}: {
  stored: StoredQuickBill
  screen: QuickBillScreen
  seatId: string | undefined
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const { confirm } = useConfirmAction()
  const { bill, scan } = stored

  const participants = useMemo(
    () =>
      bill.seats.map((seat, index) => ({
        _id: seat.id,
        name: quickBillSeatLabel(seat),
        sortOrder: index,
      })),
    [bill.seats],
  )
  const labels = useMemo(
    () => buildParticipantLabels(participants),
    [participants],
  )

  const go = (
    to: QuickBillScreen,
    options: { seat?: string; replace?: boolean } = {},
  ) =>
    void navigate({
      to: '/quick-bill',
      search: to === 'setup' ? {} : { view: to, seat: options.seat },
      replace: options.replace,
      state: (prev) => ({ ...prev, fromQuickSeats: to === 'turn' }),
    })

  /** Back to „Чий ред е?“ without stacking another entry on it. */
  function backToSeats() {
    if (canGoBack && router.state.location.state.fromQuickSeats) {
      router.history.back()
    } else {
      go('seats', { replace: true })
    }
  }

  async function close() {
    if (!(await confirm(getQuickBillCloseCopy()))) return
    writeQuickBill(null)
    void navigate({ to: '/', replace: true })
  }

  // Lines first: nothing to pass around until the receipt is read.
  const ready = bill.lines.length > 0 && scan.phase === 'read'
  const turnSeat =
    screen === 'turn'
      ? bill.seats.find((seat) => seat.id === seatId)
      : undefined
  const shown: QuickBillScreen = !ready
    ? 'setup'
    : screen === 'turn' && !turnSeat
      ? 'seats'
      : screen

  return (
    <SeatsProvider participants={participants} hostParticipantId={null}>
      <FlightLayer>
        {shown === 'setup' ? (
          <QuickSetup
            stored={stored}
            onStart={() => go('seats')}
            onCancel={() => void close()}
          />
        ) : shown === 'seats' ? (
          <QuickSeats
            bill={bill}
            onPick={(id) => go('turn', { seat: id })}
            onSummary={() => go('summary')}
            onLines={() => go('setup')}
          />
        ) : shown === 'turn' && turnSeat ? (
          <QuickTurn
            key={turnSeat.id}
            bill={bill}
            seat={turnSeat}
            labels={labels}
            onDone={() => {
              editQuickBill((b) => markQuickBillSeatDone(b, turnSeat.id))
              backToSeats()
            }}
            onNotMe={backToSeats}
          />
        ) : (
          <QuickSummary
            bill={bill}
            labels={labels}
            onBackToSeats={() => go('seats')}
            onClose={() => void close()}
          />
        )}
      </FlightLayer>
    </SeatsProvider>
  )
}
