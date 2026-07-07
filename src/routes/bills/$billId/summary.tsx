import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ParticipantDetailSheet } from '#/components/bills/participant-detail-sheet.tsx'
import { PaymentProgress } from '#/components/bills/payment-progress.tsx'
import { PaymentRow } from '#/components/bills/payment-row.tsx'
import { PaymentSettingsSheet } from '#/components/bills/payment-settings-sheet.tsx'
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
  const [settingsOpen, setSettingsOpen] = useState(false)

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
    } finally {
      setIsFinalizing(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await removeBill({ billId })
      await navigate({ to: '/' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
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
            <CardTitle>Обща сума</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatEur(totals.billTotalCents)}
            </p>
            {bill.note && (
              <p className="mt-1 text-sm text-muted-foreground">{bill.note}</p>
            )}
          </CardContent>
        </Card>

        <ShareBillButton
          restaurantName={bill.restaurantName}
          date={new Date(bill.date)}
          billTotalCents={totals.billTotalCents}
          participants={participants.map((p) => ({
            label: labels[p._id] ?? p.name,
            sortOrder: p.sortOrder,
            totals: totals.byParticipant[p._id],
          }))}
        />
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full text-muted-foreground"
          onClick={() => setSettingsOpen(true)}
        >
          Настройки за плащане
        </Button>
        <PaymentSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />

        {bill.receiptStorageId && (
          <ReceiptPreviewCard storageId={bill.receiptStorageId} />
        )}

        {isDraft && errors.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">
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

        {isDraft && errors.length === 0 && (
          <Button
            className="h-11"
            onClick={handleFinalize}
            disabled={isFinalizing}
          >
            Завърши сметка
          </Button>
        )}

        <PaymentProgress
          participants={participants.map((p) => ({
            id: p._id,
            sortOrder: p.sortOrder,
          }))}
          byParticipant={totals.byParticipant}
        />

        <Card>
          <CardHeader>
            <CardTitle>Плащания</CardTitle>
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
                />
              )
            })}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={() =>
              void navigate({ to: '/bills/$billId', params: { billId } })
            }
          >
            Редактирай
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" className="h-11 flex-1">
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
          />
        )}
      </div>
    </div>
  )
}
