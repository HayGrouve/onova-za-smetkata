import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  SendIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { CombinedCoverNotice } from '#/components/bills/combined-cover-notice.tsx'
import { GuestStepsBar } from '#/components/bills/guest-steps-bar.tsx'
import { ParticipantBreakdownContent } from '#/components/bills/participant-breakdown-content.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { useGuestBillSession } from '#/hooks/use-guest-bill-session.ts'
import { useGuestClaimSession } from '#/hooks/use-guest-claim-session.ts'
import { useGuestPayment } from '#/hooks/use-guest-payment.ts'
import { ICON } from '#/lib/app-icons.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import { cn } from '#/lib/utils.ts'
import { paymentStatusLabel } from '../../../../shared/participant-share-view.ts'
import { mapGuestBillToClaimSessionInput } from '../../../../shared/guest-flow-session.ts'
import type { GuestClaimSeatShare } from '../../../../shared/guest-claim-session.ts'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/pay')({
  head: () => buildNoIndexHead('Плащане'),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === 'string' ? search.t : '',
  }),
  component: BillPayPage,
})

type GuestBillData = NonNullable<
  FunctionReturnType<typeof api.bills.getForGuest>
>

const EMPTY_ITEMS: never[] = []

function BillPayPage() {
  const { billId: billIdParam } = Route.useParams()
  const { t: shareTokenFromUrl } = Route.useSearch()
  const billId = billIdParam as Id<'bills'>

  return (
    <QueryErrorBoundary resetKey={`${billId}:${shareTokenFromUrl}:pay`}>
      <GuestPayContent billId={billId} shareTokenFromUrl={shareTokenFromUrl} />
    </QueryErrorBoundary>
  )
}

function GuestPayContent({
  billId,
  shareTokenFromUrl,
}: {
  billId: Id<'bills'>
  shareTokenFromUrl: string
}) {
  const {
    gate,
    data,
    pendingCover,
    shareToken,
    storedSession,
    participantId,
    mySeatIds,
    readOnly,
    labels,
  } = useGuestBillSession(billId, shareTokenFromUrl)
  const activeSeats = useQuery(
    api.guestSessions.listActiveForBill,
    shareToken ? { billId, shareToken } : 'skip',
  )

  const claimInput = useMemo(
    () => (data ? mapGuestBillToClaimSessionInput(data) : null),
    [data],
  )
  const { session } = useGuestClaimSession({
    items: claimInput?.items ?? EMPTY_ITEMS,
    assignments: claimInput?.assignments ?? EMPTY_ITEMS,
    participants: claimInput?.participants ?? EMPTY_ITEMS,
    seatId: participantId,
    mySeatIds,
    billRelations: claimInput?.billRelations,
    billContext: claimInput?.billContext,
  })

  if (
    gate.status !== 'ready' ||
    !data ||
    !storedSession ||
    !participantId ||
    !session
  ) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  const heldElsewhereIds = (activeSeats ?? [])
    .filter(
      (seat) =>
        seat.heldByParticipantId !== undefined &&
        seat.heldByParticipantId !== participantId,
    )
    .map((seat) => seat.participantId as string)

  return (
    <GuestPayReady
      billId={billId}
      shareToken={shareToken}
      sessionToken={storedSession.sessionToken}
      data={data}
      payerId={participantId}
      mySeatIds={mySeatIds}
      seatShares={session.seatShares}
      freeUnits={session.tableProgress.freeUnits}
      labels={labels}
      readOnly={readOnly}
      pendingCover={pendingCover ?? null}
      heldElsewhereIds={heldElsewhereIds}
    />
  )
}

function GuestPayReady({
  billId,
  shareToken,
  sessionToken,
  data,
  payerId,
  mySeatIds,
  seatShares,
  freeUnits,
  labels,
  readOnly,
  pendingCover,
  heldElsewhereIds,
}: {
  billId: Id<'bills'>
  shareToken: string
  sessionToken: string
  data: GuestBillData
  payerId: Id<'participants'>
  mySeatIds: Id<'participants'>[]
  seatShares: GuestClaimSeatShare[]
  freeUnits: number
  labels: Record<string, string>
  readOnly: boolean
  pendingCover: { payerName: string; coveredAmountCents: number } | null
  heldElsewhereIds: string[]
}) {
  const navigate = useNavigate()
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

  const nothingClaimed = seatShares.every(
    (share) => share.totals.owedCents === 0,
  )

  function backToItems() {
    void navigate({
      to: '/bills/$billId/claim',
      params: { billId },
      search: { t: shareToken },
    })
  }

  return (
    <div className="page-container">
      <div className="flex flex-col gap-4 py-4 pb-10">
        <GuestStepsBar step={3} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 h-9 self-start"
          onClick={backToItems}
        >
          <ArrowLeftIcon className={ICON.button} aria-hidden />
          Към артикулите
        </Button>

        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {data.bill.restaurantName.trim() || 'Сметка'}
          </p>
          <h2 className="text-lg font-semibold">
            {readOnly ? 'Разбивка' : 'Преглед и плащане'}
          </h2>
        </div>

        {pendingCover ? (
          <CombinedCoverNotice
            payerName={pendingCover.payerName}
            coveredAmountCents={pendingCover.coveredAmountCents}
          />
        ) : null}

        {!readOnly && freeUnits > 0 ? (
          <div
            className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            data-testid="pay-free-units-warning"
          >
            <AlertTriangleIcon
              className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500"
              aria-hidden
            />
            <p>
              {freeUnits}{' '}
              {freeUnits === 1
                ? 'бройка още не е отбелязана'
                : 'бройки още не са отбелязани'}{' '}
              от никого. Ако някоя е ваша, отбележете я преди да платите.
            </p>
          </div>
        ) : null}

        {nothingClaimed ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                Още не сте отбелязали нищо.
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={backToItems}
              >
                Отбележете артикулите си
              </Button>
            </CardContent>
          </Card>
        ) : (
          seatShares.map((share) => (
            <SeatShareCard
              key={share.seatId}
              billId={billId}
              share={share}
              label={labels[share.seatId] ?? 'Участник'}
              labels={labels}
            />
          ))
        )}

        {!readOnly ? (
          <Card>
            <CardHeader>
              <CardTitle>За кого плащате</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {mySeatIds.map((seatId) => (
                <PayForRow
                  key={seatId}
                  label={labels[seatId] ?? 'Участник'}
                  hint={seatId === payerId ? 'вие' : 'от този телефон'}
                  amountCents={payment.remainingOf(seatId)}
                  selected
                  locked
                />
              ))}
              {payment.extraCandidates.length > 0 ? (
                <>
                  <p className="pt-2 text-xs text-muted-foreground">
                    Можете да платите и за:
                  </p>
                  {payment.extraCandidates.map((candidate) => (
                    <PayForRow
                      key={candidate.participantId}
                      label={labels[candidate.participantId] ?? candidate.name}
                      amountCents={candidate.remainingCents}
                      selected={payment.coveredIds.includes(
                        candidate.participantId,
                      )}
                      locked={payment.selectionLocked}
                      onToggle={() =>
                        void payment.toggleExtra(candidate.participantId)
                      }
                    />
                  ))}
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {!readOnly ? (
          <Card>
            <CardContent className="flex flex-col gap-3">
              {payment.transferInitiated ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    {payment.pendingStatusLabel}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={() => void payment.cancelPending()}
                  >
                    Отмени
                  </Button>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Общо за плащане</p>
                <p className="money text-2xl font-bold" data-testid="pay-total">
                  {formatEur(payment.amountCents)}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {payment.hasRevolut ? (
                  <Button
                    type="button"
                    className="h-12 text-base"
                    disabled={!payment.canPay || payment.busy}
                    onClick={payment.payWithRevolut}
                  >
                    <SendIcon className={ICON.button} aria-hidden />
                    Плати с Revolut
                  </Button>
                ) : null}
                {payment.hasIban ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 text-base"
                    disabled={payment.busy}
                    onClick={() => void payment.copyIban()}
                  >
                    <CopyIcon className={ICON.button} aria-hidden />
                    Копирай IBAN и сума
                  </Button>
                ) : null}
              </div>
              {payment.settingsLoaded &&
              !payment.hasRevolut &&
              !payment.hasIban ? (
                <p className="text-xs text-muted-foreground">
                  Домакинът още не е добавил Revolut или IBAN — попитайте го как
                  да платите.
                </p>
              ) : payment.amountCents <= 0 && !payment.transferInitiated ? (
                <p className="text-xs text-muted-foreground">
                  Няма оставащо за плащане.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  След превода домакинът потвърждава плащането.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function SeatShareCard({
  billId,
  share,
  label,
  labels,
}: {
  billId: Id<'bills'>
  share: GuestClaimSeatShare
  label: string
  labels: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className="tap-feedback flex w-full items-center justify-between gap-3 px-6 text-left"
          aria-label={`Разбивка за ${label}`}
        >
          <div className="min-w-0">
            <p className="font-medium">{label}</p>
            <Badge variant="outline" className="mt-1">
              {paymentStatusLabel(share.totals.status)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <p className="money text-lg font-semibold">
              {formatEur(share.totals.owedCents)}
            </p>
            <ChevronDownIcon
              className={cn(
                ICON.button,
                'transition-transform',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-6 pt-4">
          <ParticipantBreakdownContent
            billId={billId}
            participantId={share.seatId as Id<'participants'>}
            label={label}
            breakdownInput={share.breakdownInput}
            totals={share.totals}
            showPaymentActions={false}
            showPayActions={false}
            showStatusBadge={false}
            participantLabels={labels}
          />
        </CollapsibleContent>
      </Collapsible>
    </Card>
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
        'flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm',
        selected ? 'border-primary/50 bg-primary/10' : 'bg-background',
        !locked && 'tap-feedback',
        locked && 'cursor-default disabled:opacity-100',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full border',
            selected && 'border-primary bg-primary text-primary-foreground',
          )}
        >
          {selected ? <CheckIcon className="size-3.5" /> : null}
        </span>
        <span className="truncate font-medium">{label}</span>
        {hint ? (
          <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <span className="money shrink-0">{formatEur(amountCents)}</span>
    </button>
  )
}
