import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  SendIcon,
} from 'lucide-react'
import { CombinedCoverNotice } from '#/components/bills/combined-cover-notice.tsx'
import { BillHeaderSlot } from '#/components/layout/bill-header-title.tsx'
import { Perforation } from '#/components/receipt/paper.tsx'
import { SeatsProvider } from '#/components/receipt/seats.tsx'
import { ShareLines } from '#/components/receipt/share-lines.tsx'
import { Stamp } from '#/components/receipt/stamp.tsx'
import { Timeline } from '#/components/receipt/timeline.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useGuestPayment } from '#/hooks/use-guest-payment.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { joinLabels } from '#/lib/participant-labels.ts'
import { cn } from '#/lib/utils.ts'
import { useGuestLiveReceipt } from '#/hooks/use-guest-live-receipt.ts'
import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { formatIbanGroups } from '../../../shared/payment-settings-schema.ts'

type GuestBillData = NonNullable<
  FunctionReturnType<typeof api.bills.getForGuest>
>

type ActiveSeats = FunctionReturnType<
  typeof api.guestSessions.listActiveForBill
>

export interface GuestPayViewProps {
  billId: Id<'bills'>
  shareToken: string
  sessionToken: string
  data: GuestBillData
  payerId: Id<'participants'>
  mySeatIds: Id<'participants'>[]
  activeSeats: ActiveSeats | undefined
  labels: Record<string, string>
  readOnly: boolean
  pendingCover: { payerName: string; coveredAmountCents: number } | null
  heldElsewhereIds: string[]
}

/**
 * The slip the guest tore off the receipt: the amount first, then Revolut or
 * IBAN. Opening Revolut (or copying the IBAN) records the transfer; the Host
 * confirms it and the slip gets its „Платено“ stamp.
 */
export function GuestPayView({
  billId,
  shareToken,
  sessionToken,
  data,
  payerId,
  mySeatIds,
  activeSeats,
  labels,
  readOnly,
  pendingCover,
  heldElsewhereIds,
}: GuestPayViewProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const [showLines, setShowLines] = useState(false)
  const payment = useGuestPayment({
    billId,
    shareToken,
    sessionToken,
    payerId,
    coveredSeatIds: mySeatIds.filter((id) => id !== payerId),
    balances: data.participantBalances,
    labels,
    restaurantName: data.bill.restaurantName,
    locked: readOnly || pendingCover !== null,
    heldElsewhereIds,
  })

  const receipt = useGuestLiveReceipt(data, activeSeats)
  const { freeUnits } = receipt
  const owed = mySeatIds.reduce(
    (sum, id) => sum + (receipt.seat(id)?.owedCents ?? 0),
    0,
  )
  const remaining = mySeatIds.reduce(
    (sum, id) => sum + payment.remainingOf(id),
    0,
  )
  const nothingClaimed = owed === 0
  const settled = owed > 0 && remaining === 0
  const pending = payment.transferInitiated
  const seatNames = mySeatIds.map((id) =>
    id === payerId ? 'вас' : (labels[id] ?? 'Участник'),
  )
  const hostName = data.hostParticipantId
    ? (labels[data.hostParticipantId] ?? 'Домакинът')
    : 'Домакинът'

  function backToReceipt() {
    // The slip was torn off the receipt: step back to it rather than stacking
    // another claim entry, so the phone's Back button then leaves the bill.
    if (canGoBack && router.state.location.state.fromReceipt) {
      router.history.back()
      return
    }
    void navigate({
      to: '/bills/$billId/claim',
      params: { billId },
      search: { t: shareToken },
      replace: true,
    })
  }

  return (
    <SeatsProvider
      participants={data.participants}
      hostParticipantId={data.hostParticipantId}
    >
      <BillHeaderSlot>
        <Timeline phase="settle" final={readOnly} />
      </BillHeaderSlot>
      <div className="mx-auto w-full max-w-[460px] px-3 pt-3 pb-24 sm:pt-8">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3"
          onClick={backToReceipt}
        >
          <ArrowLeftIcon className="size-4" strokeWidth={1.75} aria-hidden />
          Обратно към бележката
        </Button>

        {pendingCover ? (
          <div className="mb-4">
            <CombinedCoverNotice
              payerName={pendingCover.payerName}
              coveredAmountCents={pendingCover.coveredAmountCents}
            />
          </div>
        ) : null}

        <motion.div
          initial={{ y: 70, rotate: 4, opacity: 0 }}
          animate={{ y: 0, rotate: -1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 20 }}
          className="paper-shadow"
        >
          <div className="paper stub thermal relative px-5 pt-5 pb-6">
            <div className="flex items-baseline justify-between gap-3 text-[11px] text-ink-muted">
              <span className="min-w-0 truncate">
                {data.bill.restaurantName.trim() || 'Сметка'}
              </span>
              <span className="shrink-0">за {joinLabels(seatNames)}</span>
            </div>
            <Perforation className="-mx-5 my-2" />

            <p className="text-[12px] text-ink-muted">
              {settled
                ? 'Платихте'
                : pending
                  ? 'Преведохте'
                  : readOnly
                    ? 'Вашият дял'
                    : 'За плащане'}
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p
                className="font-display text-[48px] leading-none font-extrabold tracking-[-0.03em] sm:text-[56px]"
                data-testid="pay-total"
              >
                {formatEur(settled || readOnly ? owed : payment.amountCents)}
              </p>
              {!readOnly &&
              !settled &&
              !nothingClaimed &&
              payment.hasIban &&
              payment.canCopyAmount ? (
                <Button
                  type="button"
                  variant="outline"
                  className="px-3 text-[12px]"
                  onClick={() => void payment.copyAmount()}
                >
                  <CopyIcon
                    className="size-3.5"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  Копирай сумата
                </Button>
              ) : null}
            </div>
            <div className="pointer-events-none absolute top-11 right-4">
              <AnimatePresence initial={false}>
                {settled ? (
                  <Stamp key="paid" className="text-[22px]">
                    Платено
                  </Stamp>
                ) : pending ? (
                  <Stamp key="wait" kind="wait" className="text-[18px]">
                    Чака
                  </Stamp>
                ) : null}
              </AnimatePresence>
            </div>

            {nothingClaimed ? (
              <div className="mt-4 space-y-3 text-[12px]">
                <p>Още не сте отбелязали нищо.</p>
                <Button type="button" variant="outline" onClick={backToReceipt}>
                  Отбележете какво сте яли
                </Button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowLines((open) => !open)}
                  aria-expanded={showLines}
                  className="mt-3 flex min-h-11 items-center gap-1 text-[12px] font-semibold"
                >
                  Какво плащате
                  <ChevronDownIcon
                    className={cn(
                      'size-4 transition-transform',
                      showLines && 'rotate-180',
                    )}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </button>
                <AnimatePresence initial={false}>
                  {showLines ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {mySeatIds.map((seatId) => (
                        <div key={seatId} className="pb-3">
                          {mySeatIds.length > 1 ? (
                            <p className="pt-1 pb-0.5 text-[12px] font-semibold">
                              {labels[seatId] ?? 'Участник'}
                            </p>
                          ) : null}
                          <ShareLines
                            breakdownInput={receipt.breakdownInput}
                            participantId={seatId}
                            labels={labels}
                          />
                        </div>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </>
            )}

            {!readOnly && freeUnits > 0 && !settled ? (
              <p
                className="mt-2 flex items-start gap-2 text-[11px] leading-snug"
                data-testid="pay-free-units-warning"
              >
                <AlertTriangleIcon
                  className="mt-px size-3.5 shrink-0 text-stamp"
                  strokeWidth={2}
                  aria-hidden
                />
                {freeUnits}{' '}
                {freeUnits === 1
                  ? 'бройка още не е отбелязана'
                  : 'бройки още не са отбелязани'}{' '}
                от никого. Ако някоя е ваша, отбележете я преди да платите.
              </p>
            ) : null}

            {!readOnly && !settled && !nothingClaimed ? (
              <>
                <Perforation className="-mx-5 my-3" />
                <PayFor
                  payment={payment}
                  payerId={payerId}
                  mySeatIds={mySeatIds}
                  labels={labels}
                />
              </>
            ) : null}

            <Perforation className="-mx-5 my-3" />

            {settled ? (
              <div className="space-y-3 text-[12px]">
                <p className="leading-relaxed">
                  {hostName} потвърди плащането. Сметката ви е чиста, можете да
                  затворите страницата.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={backToReceipt}
                >
                  Обратно към бележката
                </Button>
              </div>
            ) : readOnly ? (
              <p className="text-[12px] leading-relaxed">
                Сметката е приключена. Ако дължите нещо, {hostName} ще ви пише.
              </p>
            ) : pending ? (
              <div className="space-y-2 text-[12px]">
                <p className="leading-relaxed">
                  {payment.pendingStatusLabel} Тук ще се появи печат „Платено“,
                  щом {hostName} потвърди.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-[12px]"
                  onClick={() => void payment.cancelPending()}
                >
                  Още не съм превел, отмени
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {payment.hasRevolut ? (
                  <Button
                    type="button"
                    size="lg"
                    className="min-h-14 w-full text-[15px]"
                    disabled={!payment.canPay || payment.busy}
                    onClick={payment.payWithRevolut}
                  >
                    <SendIcon
                      className="size-4"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    Плати с Revolut
                  </Button>
                ) : null}
                {payment.hasIban ? (
                  <div>
                    <p className="text-[11px] text-ink-muted">
                      {payment.hasRevolut
                        ? 'или по банков път'
                        : 'По банков път'}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      {/* Groups of four, wrapping between groups; the copy stays raw. */}
                      <span className="min-w-0 flex-1 text-[13px] font-semibold break-words">
                        {formatIbanGroups(payment.iban)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        disabled={payment.busy}
                        onClick={() => void payment.copyIban()}
                      >
                        <CopyIcon
                          className="size-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        Копирай IBAN
                      </Button>
                    </div>
                  </div>
                ) : null}
                {payment.settingsLoaded &&
                !payment.hasRevolut &&
                !payment.hasIban ? (
                  <p className="text-[12px] leading-relaxed">
                    {hostName} още не е добавил Revolut или IBAN. Попитайте как
                    да платите.
                  </p>
                ) : payment.amountCents <= 0 ? (
                  <p className="text-[11px] text-ink-muted">
                    Няма оставащо за плащане.
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-ink-muted">
                    След превода {hostName} потвърждава плащането.
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </SeatsProvider>
  )
}

/** „За кого плащате“: own and Covered seats always, other guests optional. */
function PayFor({
  payment,
  payerId,
  mySeatIds,
  labels,
}: {
  payment: ReturnType<typeof useGuestPayment>
  payerId: string
  mySeatIds: string[]
  labels: Record<string, string>
}) {
  return (
    <section aria-label="За кого плащате" className="space-y-1">
      <p className="text-[12px] font-semibold">За кого плащате</p>
      {mySeatIds.map((id) => (
        <PayForRow
          key={id}
          label={labels[id] ?? 'Участник'}
          hint={id === payerId ? 'вие' : 'от този телефон'}
          amountCents={payment.remainingOf(id)}
          selected
          locked
        />
      ))}
      {payment.extraCandidates.length > 0 ? (
        <>
          <p className="pt-2 text-[11px] text-ink-muted">
            Можете да платите и за:
          </p>
          {payment.extraCandidates.map((candidate) => (
            <PayForRow
              key={candidate.participantId}
              label={labels[candidate.participantId] ?? candidate.name}
              amountCents={candidate.remainingCents}
              selected={payment.coveredIds.includes(candidate.participantId)}
              locked={payment.selectionLocked}
              onToggle={() => void payment.toggleExtra(candidate.participantId)}
            />
          ))}
        </>
      ) : null}
    </section>
  )
}

function PayForRow({
  label,
  hint,
  amountCents,
  selected,
  locked,
  onToggle,
}: {
  label: string
  hint?: string
  amountCents: number
  selected: boolean
  locked: boolean
  onToggle?: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={locked}
      onClick={onToggle}
      className={cn(
        'flex min-h-11 w-full items-center gap-2 text-left text-[12px]',
        locked && 'cursor-default',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-[3px] border-2 border-ink',
          selected && 'bg-ink text-paper',
        )}
      >
        {selected ? <CheckIcon className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 truncate font-medium">{label}</span>
      {hint ? <span className="shrink-0 text-ink-muted">{hint}</span> : null}
      <span className="leader" aria-hidden />
      <span className="money shrink-0">{formatEur(amountCents)}</span>
    </button>
  )
}
