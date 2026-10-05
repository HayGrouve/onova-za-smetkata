import { AnimatePresence } from 'motion/react'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { BanknoteIcon, BellIcon, CheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Perforation } from '#/components/receipt/paper.tsx'
import { SeatAvatar } from '#/components/receipt/seats.tsx'
import type { Seat } from '#/components/receipt/seats.tsx'
import { Stamp } from '#/components/receipt/stamp.tsx'
import { Button } from '#/components/ui/button.tsx'
import { shareOrCopyText } from '#/lib/bill-share.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { cn } from '#/lib/utils.ts'
import type { ParticipantTotals } from '../../../shared/bill-calculations.ts'
import type { SeatStatus } from '../../../shared/live-receipt.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

/** One person's slip as the Host sees it. */
export interface HostSlipModel {
  seat: Seat
  status: SeatStatus
  totals: ParticipantTotals
  units: number
  /** Awaiting the Host: the request and what it covers. */
  pending: {
    requestId: Id<'combinedPaymentRequests'>
    totalCents: number
    /** Who sent the transfer; a Covered seat's slip points at them. */
    payerId: string
    payerLabel: string
  } | null
}

const RANK: Record<SeatStatus, number> = {
  pending: 0,
  owes: 1,
  empty: 2,
  paid: 3,
  host: 4,
}

export function sortSlips(slips: HostSlipModel[]): HostSlipModel[] {
  return [...slips].sort((a, b) => RANK[a.status] - RANK[b.status])
}

export function HostSlip({
  billId,
  slip,
  big,
  readOnly,
  restaurantName,
  joinUrl,
  onOpen,
}: {
  billId: Id<'bills'>
  slip: HostSlipModel
  /** Разплащане: bigger amounts and every action. */
  big: boolean
  readOnly: boolean
  restaurantName: string
  joinUrl: string | null
  onOpen: () => void
}) {
  const confirmRequest = useMutation(api.combinedPayments.confirm)
  const addPayment = useMutation(api.payments.add)
  const undoLast = useMutation(api.payments.undoLast)
  const [busy, setBusy] = useState(false)
  const { seat, status, totals } = slip
  const remaining = Math.max(0, totals.balanceCents)
  const participantId = seat.id as Id<'participants'>

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      toast.success(success)
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function remind() {
    const where = restaurantName.trim()
      ? `„${restaurantName.trim()}“`
      : 'сметката'
    const link = joinUrl ? ` Може да платиш от линка: ${joinUrl}` : ''
    try {
      const result = await shareOrCopyText(
        `Здрасти, ${seat.label}! За ${where} остава ${formatEur(remaining)}.${link}`,
        'Напомняне',
      )
      if (result === 'copied') toast.success('Напомнянето е копирано')
    } catch {
      // Cancelled share sheet.
    }
  }

  const paysForSelf = slip.pending?.payerId === seat.id
  const actions = readOnly ? null : status === 'pending' &&
    slip.pending &&
    paysForSelf ? (
    <Button
      type="button"
      size="sm"
      disabled={busy}
      onClick={() =>
        void run(
          () => confirmRequest({ billId, requestId: slip.pending!.requestId }),
          `${seat.label}: платено`,
        )
      }
    >
      <CheckIcon className="size-4" strokeWidth={2.25} aria-hidden />
      Потвърди {formatEur(slip.pending.totalCents)}
    </Button>
  ) : status === 'owes' && big ? (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        aria-label={`Отбележи ${seat.label} като платил в брой`}
        onClick={() =>
          void run(
            () =>
              addPayment({
                billId,
                participantId,
                amountCents: remaining,
                note: 'В брой',
              }),
            `${seat.label}: платено`,
          )
        }
      >
        <BanknoteIcon className="size-4" strokeWidth={1.75} aria-hidden />В брой
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void remind()}
      >
        <BellIcon className="size-4" strokeWidth={1.75} aria-hidden />
        Напомни
      </Button>
    </>
  ) : status === 'paid' && big ? (
    <button
      type="button"
      className="min-h-11 px-1 text-[11px] text-ink-muted underline decoration-dotted decoration-2 underline-offset-4"
      disabled={busy}
      onClick={() =>
        void run(
          () => undoLast({ billId, participantId }),
          'Плащането е отменено',
        )
      }
    >
      Отмени плащането
    </button>
  ) : null

  return (
    <div className={cn('py-3', big && 'py-4')}>
      <div className="flex items-center gap-3">
        <SeatAvatar seat={seat} size={big ? 'md' : 'sm'} />
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
          aria-label={`Разбивка за ${seat.label}`}
        >
          <span className="flex items-baseline gap-2">
            <span className="truncate font-semibold">{seat.label}</span>
            {status === 'host' ? (
              <span className="text-[11px] text-ink-muted">домакин</span>
            ) : null}
          </span>
          <span className="block text-[11px] leading-snug text-ink-muted">
            {status === 'pending' && slip.pending
              ? paysForSelf
                ? `отбеляза превод ${formatEur(slip.pending.totalCents)}`
                : `плаща ${slip.pending.payerLabel}`
              : status === 'paid'
                ? `платени ${formatEur(totals.paidCents)}`
                : status === 'host'
                  ? `ваш дял ${formatEur(totals.owedCents)}`
                  : totals.owedCents > 0
                    ? slip.units > 0
                      ? `${slip.units} бр., дял ${formatEur(totals.owedCents)}`
                      : `още нищо, бакшиш ${formatEur(totals.owedCents)}`
                    : 'още нищо не е отбелязал'}
          </span>
        </button>
        <div className="relative flex min-h-9 shrink-0 items-center justify-end">
          {status === 'owes' ? (
            <span
              className={cn(
                'font-display font-bold',
                big ? 'text-[18px]' : 'text-[14px]',
              )}
            >
              {formatEur(remaining)}
            </span>
          ) : null}
          {status === 'host' ? (
            <span className="text-[12px] text-ink-muted">не дължи</span>
          ) : null}
          <AnimatePresence initial={false}>
            {status === 'paid' ? (
              <Stamp key="paid" className={big ? 'text-[16px]' : 'text-[12px]'}>
                Платено
              </Stamp>
            ) : null}
            {status === 'pending' ? (
              <Stamp
                key="wait"
                kind="wait"
                className={big ? 'text-[14px]' : 'text-[11px]'}
              >
                Чака
              </Stamp>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      {actions ? (
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">{actions}</div>
      ) : null}
    </div>
  )
}

/** Slips continuing the receipt on phones: perforation, then each person. */
export function SlipStack(props: {
  billId: Id<'bills'>
  slips: HostSlipModel[]
  big: boolean
  readOnly: boolean
  restaurantName: string
  joinUrl: string | null
  onOpen: (seatId: string) => void
}) {
  return (
    <div>
      {sortSlips(props.slips).map((slip) => (
        <div key={slip.seat.id} className="slip -mt-px px-4 sm:px-6">
          <Perforation className="-mx-4 sm:-mx-6" />
          <HostSlip
            billId={props.billId}
            slip={slip}
            big={props.big}
            readOnly={props.readOnly}
            restaurantName={props.restaurantName}
            joinUrl={props.joinUrl}
            onOpen={() => props.onOpen(slip.seat.id)}
          />
        </div>
      ))}
    </div>
  )
}
