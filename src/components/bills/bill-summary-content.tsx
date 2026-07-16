import {
  AlertCircleIcon,
  BanknoteIcon,
  CheckCircleIcon,
  CircleDollarSignIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { CombinedPaymentBanner } from '#/components/bills/combined-payment-banner.tsx'
import { ParticipantDetailSheet } from '#/components/bills/participant-detail-sheet.tsx'
import { PaymentProgress } from '#/components/bills/payment-progress.tsx'
import { PaymentRow } from '#/components/bills/payment-row.tsx'
import {
  PaymentSettingsOpenButton,
  usePaymentSettingsStatus,
} from '#/components/bills/payment-settings-open-button.tsx'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { ReceiptPreviewCard } from '#/components/bills/receipt-preview-card.tsx'
import { ShareBillButton } from '#/components/bills/share-bill-button.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip.tsx'
import {
  calculateBillTotals,
  validateBillForFinalize,
} from '#/lib/bill-calculations.ts'
import type {
  BillBreakdownInput,
  PaymentStatus,
} from '#/lib/bill-calculations.ts'
import { getBillDeleteCopy } from '#/lib/destructive-action-copy.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { ICON } from '#/lib/app-icons.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { isHostParticipant } from '../../../shared/host-bill-participant.ts'
import { cn } from '#/lib/utils.ts'
import { BillHeaderTitleSync } from '#/components/layout/bill-header-title.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export interface BillSummaryContentProps {
  billId: Id<'bills'>
  /** Hide back-to-editor affordances when rendered as step 4 of the editor. */
  embedded?: boolean
}

export function BillSummaryContent({
  billId,
  embedded = false,
}: BillSummaryContentProps) {
  const navigate = useNavigate()
  const data = useQuery(api.bills.get, { billId })
  const finalizeBill = useMutation(api.bills.finalize)
  const removeBill = useMutation(api.bills.remove)
  const { confirm } = useConfirmAction()
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [detailParticipantId, setDetailParticipantId] =
    useState<Id<'participants'> | null>(null)
  const paymentSettingsStatus = usePaymentSettingsStatus()
  const { openPaymentSettings } = usePaymentSettingsSheet()

  const calcInputs = useMemo(() => {
    if (!data) return null
    return {
      participants: data.participants.map((p) => ({
        id: p._id,
        sortOrder: p.sortOrder,
      })),
      items: data.items.map((i) => ({
        id: i._id,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
      })),
      assignments: data.assignments.map((a) => ({
        itemId: a.itemId,
        participantId: a.participantId,
        units: a.units,
      })),
      tipCents: data.bill.tipCents ?? 0,
      hostParticipantId: data.bill.hostParticipantId,
    }
  }, [data])

  const totals = useMemo(() => {
    if (!data || !calcInputs) return null
    return calculateBillTotals({
      ...calcInputs,
      payments: data.payments.map((p) => ({
        participantId: p.participantId,
        amountCents: p.amountCents,
      })),
    })
  }, [data, calcInputs])

  const errors = useMemo(() => {
    if (!calcInputs || !data) return []
    return validateBillForFinalize({
      ...calcInputs,
      restaurantName: data.bill.restaurantName,
      payments: data.payments.map((p) => ({
        participantId: p.participantId,
        amountCents: p.amountCents,
      })),
    })
  }, [calcInputs, data])

  const labels = useMemo(
    () => (data ? buildParticipantLabels(data.participants) : {}),
    [data],
  )

  const breakdownInput = useMemo((): BillBreakdownInput | null => {
    if (!data) return null
    return {
      participants: data.participants.map((p) => ({
        id: p._id,
        sortOrder: p.sortOrder,
      })),
      items: data.items.map((i) => ({
        id: i._id,
        name: i.name,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
      })),
      assignments: data.assignments.map((a) => ({
        itemId: a.itemId,
        participantId: a.participantId,
        units: a.units,
      })),
      tipCents: data.bill.tipCents ?? 0,
    }
  }, [data])

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!totals) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        Сметката не е намерена.
      </div>
    )
  }

  const { bill, participants } = data

  const statusOrder: Record<PaymentStatus, number> = {
    unpaid: 0,
    partial: 1,
    paid: 2,
  }

  const sortedParticipants = [...participants].sort((a, b) => {
    const statusA = totals.byParticipant[a._id].status
    const statusB = totals.byParticipant[b._id].status
    const statusDiff = statusOrder[statusA] - statusOrder[statusB]
    if (statusDiff !== 0) return statusDiff
    return a.sortOrder - b.sortOrder
  })
  const isDraft = bill.status === 'draft'
  const canFinalize = errors.length === 0
  const unpaidCount = participants.filter(
    (participant) =>
      !isHostParticipant(participant._id, bill.hostParticipantId) &&
      totals.byParticipant[participant._id].status !== 'paid',
  ).length

  async function handleFinalize() {
    setIsFinalizing(true)
    try {
      await finalizeBill({ billId })
      setFinalizeOpen(false)
      toast.success('Сметката е завършена')
    } catch {
      toast.error('Неуспешно завършване на сметката')
    } finally {
      setIsFinalizing(false)
    }
  }

  async function handleDeleteWithConfirm() {
    const confirmed = await confirm(getBillDeleteCopy())
    if (!confirmed) return
    setIsDeleting(true)
    try {
      await removeBill({ billId })
      await navigate({ to: '/' })
    } catch {
      toast.error('Неуспешно изтриване на сметката')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!embedded && <BillHeaderTitleSync title={bill.restaurantName} />}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {dateFormatter.format(new Date(bill.date))}
        </p>
        {isDraft ? (
          <Badge variant="secondary">Чернова</Badge>
        ) : (
          <Badge>Завършена — само преглед</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleDollarSignIcon className={ICON.section} aria-hidden />
            Обща сума
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="money text-2xl font-bold">
              {formatEur(totals.billTotalCents)}
            </p>
            {bill.note && (
              <p className="mt-1 text-sm text-muted-foreground">{bill.note}</p>
            )}
          </div>
          {breakdownInput ? (
            <ShareBillButton
              restaurantName={bill.restaurantName}
              date={new Date(bill.date)}
              note={bill.note}
              billTotalCents={totals.billTotalCents}
              breakdown={breakdownInput}
              participants={participants.map((p) => ({
                id: p._id,
                label: labels[p._id] ?? p.name,
                sortOrder: p.sortOrder,
                totals: totals.byParticipant[p._id],
              }))}
            />
          ) : null}
        </CardContent>
      </Card>

      {paymentSettingsStatus === 'unconfigured' && isDraft ? (
        <Card className="border-accent-foreground/40 bg-accent/40">
          <CardContent className="flex flex-col items-start gap-2">
            <p className="text-sm">
              Настройте начин на плащане (Revolut / IBAN), за да могат гостите
              да плащат лесно.
            </p>
            <PaymentSettingsOpenButton onClick={openPaymentSettings} />
          </CardContent>
        </Card>
      ) : null}

      {bill.receiptStorageId && <ReceiptPreviewCard billId={billId} />}

      {isDraft && errors.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircleIcon className={ICON.section} aria-hidden />
              Сметката не може да бъде завършена
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-sm text-destructive">
              {errors.map((error) => (
                <li key={error.code}>{error.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="flex items-center gap-2">
            <BanknoteIcon className={ICON.section} aria-hidden />
            Плащания
          </CardTitle>
          <PaymentProgress
            participants={participants.map((p) => ({
              id: p._id,
              sortOrder: p.sortOrder,
            }))}
            byParticipant={totals.byParticipant}
            hostParticipantId={bill.hostParticipantId}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CombinedPaymentBanner billId={billId} />
          {sortedParticipants.length === 0 && (
            <p className="text-sm text-muted-foreground">Няма участници.</p>
          )}
          {sortedParticipants.map((participant) => {
            const participantTotals = totals.byParticipant[participant._id]
            const isHost = isHostParticipant(
              participant._id,
              bill.hostParticipantId,
            )
            return (
              <PaymentRow
                key={participant._id}
                billId={billId}
                participantId={participant._id}
                label={labels[participant._id] ?? participant.name}
                totals={participantTotals}
                payments={data.payments}
                isHost={isHost}
                readOnly={!isDraft}
                onOpenDetail={() => setDetailParticipantId(participant._id)}
              />
            )
          })}
        </CardContent>
      </Card>

      <Separator />

      {isDraft && (
        <>
          {unpaidCount > 0 && !canFinalize ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex w-full cursor-not-allowed">
                  <Button
                    type="button"
                    disabled
                    className="pointer-events-none h-11 w-full bg-success text-success-foreground opacity-50"
                  >
                    <CheckCircleIcon className={ICON.button} aria-hidden />
                    Завърши сметка
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-center">
                Всички гости трябва да платят, преди да завършите сметката.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              className="h-11 w-full bg-success text-success-foreground transition-colors hover:bg-success/90 focus-visible:ring-success/30 disabled:opacity-50"
              disabled={!canFinalize}
              onClick={() => setFinalizeOpen(true)}
            >
              <CheckCircleIcon className={ICON.button} aria-hidden />
              Завърши сметка
            </Button>
          )}
          <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Завършване на сметката?</DialogTitle>
                <DialogDescription asChild>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <p>
                      Обща сума:{' '}
                      <span className="money font-medium text-foreground">
                        {formatEur(totals.billTotalCents)}
                      </span>
                    </p>
                    {unpaidCount > 0 ? (
                      <p>
                        {unpaidCount} участник{unpaidCount === 1 ? '' : 'а'}{' '}
                        все още не {unpaidCount === 1 ? 'е' : 'са'} платил
                        {unpaidCount === 1 ? '' : 'и'} напълно.
                      </p>
                    ) : (
                      <p>Всички участници са платили.</p>
                    )}
                    <p>
                      След завършване сметката е само за преглед — гостите не
                      могат да променят артикулите, а плащанията не могат да се
                      отменят или добавят.
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFinalizeOpen(false)}
                  disabled={isFinalizing}
                >
                  Отказ
                </Button>
                <Button
                  className="bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => void handleFinalize()}
                  disabled={isFinalizing || unpaidCount > 0}
                >
                  <CheckCircleIcon className={ICON.button} aria-hidden />
                  {isFinalizing ? 'Завършване...' : 'Завърши сметка'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      <div className="flex gap-2">
        {isDraft && !embedded ? (
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={() =>
              void navigate({
                to: '/bills/$billId',
                params: { billId },
                search: { step: 1 },
              })
            }
          >
            <PencilIcon className={ICON.button} aria-hidden />
            Редактирай
          </Button>
        ) : null}
        <Button
          variant="destructive"
          className={cn('h-11', isDraft && !embedded ? 'flex-1' : 'w-full')}
          disabled={isDeleting}
          onClick={() => void handleDeleteWithConfirm()}
        >
          <Trash2Icon className={ICON.button} aria-hidden />
          Изтрий
        </Button>
      </div>

      {detailParticipantId && (
        <ParticipantDetailSheet
          open
          onOpenChange={(open) => {
            if (!open) setDetailParticipantId(null)
          }}
          billId={billId}
          participantId={detailParticipantId}
          label={labels[detailParticipantId] ?? 'Участник'}
          breakdownInput={breakdownInput!}
          totals={totals.byParticipant[detailParticipantId]}
          payments={data.payments}
          onOpenPaymentSettings={openPaymentSettings}
          showPaymentActions={
            !isHostParticipant(detailParticipantId, bill.hostParticipantId)
          }
          paymentActionsReadOnly={!isDraft}
          showPayActions={false}
        />
      )}
    </div>
  )
}
