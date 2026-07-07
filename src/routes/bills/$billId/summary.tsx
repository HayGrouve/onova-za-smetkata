import {
  AlertCircleIcon,
  BanknoteIcon,
  CheckCircleIcon,
  CircleDollarSignIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ParticipantDetailSheet } from '#/components/bills/participant-detail-sheet.tsx'
import { PaymentProgress } from '#/components/bills/payment-progress.tsx'
import { PaymentRow } from '#/components/bills/payment-row.tsx'
import { PaymentSettingsOpenButton, usePaymentSettingsStatus } from '#/components/bills/payment-settings-open-button.tsx'
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
  DialogTrigger,
} from '#/components/ui/dialog.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import {
  calculateBillTotals,
  validateBillForFinalize,
  type BillBreakdownInput,
  type PaymentStatus,
} from '#/lib/bill-calculations.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { ICON } from '#/lib/app-icons.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/summary')({
  component: BillSummary,
})

const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function BillSummary() {
  const params = Route.useParams()
  const billId = params.billId as Id<'bills'>
  const navigate = useNavigate()
  const data = useQuery(api.bills.get, { billId })
  const finalizeBill = useMutation(api.bills.finalize)
  const removeBill = useMutation(api.bills.remove)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
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
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  if (data === null || !totals) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-muted-foreground">
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
    const statusA = totals.byParticipant[a._id]?.status ?? 'unpaid'
    const statusB = totals.byParticipant[b._id]?.status ?? 'unpaid'
    const statusDiff = statusOrder[statusA] - statusOrder[statusB]
    if (statusDiff !== 0) return statusDiff
    return a.sortOrder - b.sortOrder
  })
  const isDraft = bill.status === 'draft'

  async function handleFinalize() {
    setIsFinalizing(true)
    try {
      await finalizeBill({ billId })
      toast.success('Сметката е завършена')
    } catch {
      toast.error('Неуспешно завършване на сметката')
    } finally {
      setIsFinalizing(false)
    }
  }

  async function handleDelete() {
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
    <div className="page-container">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {dateFormatter.format(new Date(bill.date))}
        </p>
        {isDraft ? (
          <Badge variant="secondary">Чернова</Badge>
        ) : (
          <Badge>Завършена</Badge>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDollarSignIcon className={ICON.section} aria-hidden />
              Обща сума
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-2xl font-bold tabular-nums">
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

        {paymentSettingsStatus === 'unconfigured' ? (
          <PaymentSettingsOpenButton onClick={openPaymentSettings} />
        ) : null}

        {bill.receiptStorageId && (
          <ReceiptPreviewCard storageId={bill.receiptStorageId} />
        )}

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
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {sortedParticipants.length === 0 && (
              <p className="text-sm text-muted-foreground">Няма участници.</p>
            )}
            {sortedParticipants.map((participant) => {
              const participantTotals = totals.byParticipant[participant._id]
              return (
                <PaymentRow
                  key={participant._id}
                  billId={billId}
                  participantId={participant._id}
                  label={labels[participant._id] ?? participant.name}
                  totals={participantTotals}
                  onOpenDetail={() => setDetailParticipantId(participant._id)}
                  onOpenPaymentSettings={openPaymentSettings}
                />
              )
            })}
          </CardContent>
        </Card>

        <Separator />

        {isDraft && errors.length === 0 && (
          <Button
            className="h-11 w-full bg-emerald-800 text-white transition-colors duration-200 hover:bg-emerald-900 focus-visible:ring-emerald-800/30 dark:bg-emerald-900 dark:hover:bg-emerald-950"
            onClick={handleFinalize}
            disabled={isFinalizing}
          >
            <CheckCircleIcon className={ICON.button} aria-hidden />
            Завърши сметка
          </Button>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={() =>
              void navigate({ to: '/bills/$billId', params: { billId } })
            }
          >
            <PencilIcon className={ICON.button} aria-hidden />
            Редактирай
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" className="h-11 flex-1">
                <Trash2Icon className={ICON.button} aria-hidden />
                Изтрий
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Изтриване на сметка</DialogTitle>
                <DialogDescription>
                  Това действие е необратимо. Всички участници, артикули и
                  плащания ще бъдат изтрити заедно със сметката.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2Icon className={ICON.button} aria-hidden />
                  Изтрий сметката
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {detailParticipantId && breakdownInput && (
          <ParticipantDetailSheet
            open={detailParticipantId !== null}
            onOpenChange={(open) => {
              if (!open) setDetailParticipantId(null)
            }}
            billId={billId}
            participantId={detailParticipantId}
            label={labels[detailParticipantId] ?? 'Участник'}
            breakdownInput={breakdownInput}
            totals={totals.byParticipant[detailParticipantId]}
            onOpenPaymentSettings={openPaymentSettings}
          />
        )}
      </div>
    </div>
  )
}
