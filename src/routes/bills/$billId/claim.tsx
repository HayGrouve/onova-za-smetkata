import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { PieChartIcon } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { GuestClaimFooter } from '#/components/bills/guest-claim-footer.tsx'
import { GuestItemRow } from '#/components/bills/guest-item-row.tsx'
import { ParticipantBreakdownContent } from '#/components/bills/participant-breakdown-content.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import {
  calculateBillTotals,
  type BillBreakdownInput,
} from '#/lib/bill-calculations.ts'
import { ICON } from '#/lib/app-icons.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import {
  clearStoredGuestParticipant,
  getStoredGuestParticipant,
} from '#/lib/guest-participant-session.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/claim')({
  component: BillClaimPage,
})

function BillClaimPage() {
  const { billId: billIdParam } = Route.useParams()
  const billId = billIdParam as Id<'bills'>
  const navigate = useNavigate()
  const data = useQuery(api.bills.get, { billId })

  const storedParticipantId = useMemo(
    () => getStoredGuestParticipant(billId),
    [billId, data?.participants],
  )

  useEffect(() => {
    if (storedParticipantId === null && data !== undefined) {
      void navigate({ to: '/bills/$billId/join', params: { billId } })
    }
  }, [billId, navigate, storedParticipantId, data])

  const totals = useMemo(() => {
    if (!data || !storedParticipantId) return null
    return calculateBillTotals({
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
      payments: data.payments.map((p) => ({
        participantId: p.participantId,
        amountCents: p.amountCents,
      })),
      tipCents: data.bill.tipCents ?? 0,
    })
  }, [data, storedParticipantId])

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

  if (data === undefined || storedParticipantId === null) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  if (data === null) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Сметката не е намерена.
      </div>
    )
  }

  const participant = data.participants.find((p) => p._id === storedParticipantId)
  if (!participant) {
    clearStoredGuestParticipant(billId)
    void navigate({ to: '/bills/$billId/join', params: { billId } })
    return null
  }

  const labels = buildParticipantLabels(data.participants)
  const label = labels[participant._id] ?? participant.name
  const readOnly = data.bill.status === 'final'
  const sortedItems = [...data.items].sort((a, b) => a.sortOrder - b.sortOrder)
  const participantTotals = totals?.byParticipant[storedParticipantId]

  function handleSwitchIdentity() {
    clearStoredGuestParticipant(billId)
    void navigate({ to: '/bills/$billId/join', params: { billId } })
  }

  return (
    <div className="page-container">
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {data.bill.restaurantName.trim() || 'Сметка'}
          </p>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Вие сте: {label}</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSwitchIdentity}
            >
              Не съм {label}
            </Button>
          </div>
          {readOnly && (
            <p className="text-sm text-muted-foreground">
              Сметката е приключена — само преглед.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {sortedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Все още няма артикули.</p>
          ) : (
            sortedItems.map((item) => (
              <GuestItemRow
                key={item._id}
                item={item}
                participantId={storedParticipantId}
                itemAssignments={data.assignments.filter(
                  (assignment) => assignment.itemId === item._id,
                )}
                readOnly={readOnly}
              />
            ))
          )}
        </div>

        {participantTotals && breakdownInput ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChartIcon className={ICON.section} aria-hidden />
                Разбивка на дяла
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ParticipantBreakdownContent
                billId={billId}
                participantId={storedParticipantId}
                label={label}
                breakdownInput={breakdownInput}
                totals={participantTotals}
                showPaymentActions={false}
                showPayActions={false}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>

      {participantTotals && (
        <GuestClaimFooter
          owedCents={participantTotals.owedCents}
          remainingCents={Math.max(0, participantTotals.balanceCents)}
        />
      )}
    </div>
  )
}
