import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { SearchIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { GuestClaimFooter } from '#/components/bills/guest-claim-footer.tsx'
import { GuestItemRow } from '#/components/bills/guest-item-row.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { useGuestSessionHeartbeat } from '#/hooks/use-guest-session-heartbeat.ts'
import {
  calculateBillTotals,
  type BillBreakdownInput,
} from '#/lib/bill-calculations.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import {
  clearStoredGuestParticipant,
  getStoredGuestSession,
} from '#/lib/guest-participant-session.ts'
import { sortGuestClaimItems, filterGuestClaimItemsBySearch, filterUnclaimedGuestClaimItems } from '#/lib/guest-claim-items.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/claim')({
  component: BillClaimPage,
})

function BillClaimPage() {
  const { billId: billIdParam } = Route.useParams()
  const billId = billIdParam as Id<'bills'>
  const navigate = useNavigate()
  const data = useQuery(api.bills.getForGuest, { billId })
  const releaseSession = useMutation(api.guestSessions.release)
  const [search, setSearch] = useState('')

  const storedSession = useMemo(
    () => getStoredGuestSession(billId),
    [billId, data?.assignments, data?.participants],
  )

  const handleSessionLost = useCallback(() => {
    if (storedSession) {
      void releaseSession({
        billId,
        sessionToken: storedSession.sessionToken,
      })
    }
    clearStoredGuestParticipant(billId)
    toast.error('Сесията изтече или името е заето. Изберете отново.')
    void navigate({ to: '/bills/$billId/join', params: { billId } })
  }, [billId, navigate, releaseSession, storedSession])

  useGuestSessionHeartbeat(
    data?.bill.status === 'final' ? null : storedSession,
    handleSessionLost,
  )

  useEffect(() => {
    if (storedSession === null && data !== undefined) {
      void navigate({ to: '/bills/$billId/join', params: { billId } })
    }
  }, [billId, navigate, storedSession, data])

  const storedParticipantId = storedSession?.participantId ?? null

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

  const visibleItems = useMemo(() => {
    if (!data || !storedParticipantId) return []
    const sorted = sortGuestClaimItems(data.items)
    const unclaimed = filterUnclaimedGuestClaimItems(
      sorted,
      data.assignments,
      storedParticipantId as Id<'participants'>,
    )
    return filterGuestClaimItemsBySearch(unclaimed, search)
  }, [data, search, storedParticipantId])

  const hasUnclaimedItems = useMemo(() => {
    if (!data || !storedParticipantId) return false
    return filterUnclaimedGuestClaimItems(
      data.items,
      data.assignments,
      storedParticipantId as Id<'participants'>,
    ).length > 0
  }, [data, storedParticipantId])

  if (data === undefined || storedParticipantId === null || !storedSession) {
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
  const participantTotals = totals?.byParticipant[storedParticipantId]
  const hasItems = data.items.length > 0
  const hasSearchQuery = search.trim().length > 0

  function handleSwitchIdentity() {
    void releaseSession({
      billId,
      sessionToken: storedSession.sessionToken,
    })
    clearStoredGuestParticipant(billId)
    void navigate({ to: '/bills/$billId/join', params: { billId } })
  }

  return (
    <div className="page-container">
      <div className="flex flex-col gap-4 py-4 pb-6">
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

        {hasUnclaimedItems && (
          <div className="relative">
            <Label htmlFor="claim-item-search" className="sr-only">
              Търсене по артикул
            </Label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="claim-item-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Търсене по артикул"
              className="h-11 pl-9"
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {!hasItems ? (
            <p className="text-sm text-muted-foreground">Все още няма артикули.</p>
          ) : visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasSearchQuery
                ? 'Няма артикули, съответстващи на търсенето.'
                : hasUnclaimedItems
                  ? 'Все още няма артикули.'
                  : 'Всички артикули са отбелязани.'}
            </p>
          ) : (
            visibleItems.map((item) => (
              <GuestItemRow
                key={item._id}
                item={item}
                participantId={storedParticipantId as Id<'participants'>}
                itemAssignments={data.assignments.filter(
                  (assignment) => assignment.itemId === item._id,
                )}
                participantLabels={labels}
                readOnly={readOnly}
                onItemSelected={() => setSearch('')}
              />
            ))
          )}
        </div>
      </div>

      {participantTotals && breakdownInput ? (
        <GuestClaimFooter
          billId={billId}
          participantId={storedParticipantId as Id<'participants'>}
          label={label}
          breakdownInput={breakdownInput}
          totals={participantTotals}
          readOnly={readOnly}
        />
      ) : null}
    </div>
  )
}
