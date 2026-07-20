import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { SearchIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { GuestClaimFooter } from '#/components/bills/guest-claim-footer.tsx'
import { HostClaimFooter } from '#/components/bills/host-claim-footer.tsx'
import { CombinedCoverNotice } from '#/components/bills/combined-cover-notice.tsx'
import { GuestItemRow } from '#/components/bills/guest-item-row.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { useGuestSessionHeartbeat } from '#/hooks/use-guest-session-heartbeat.ts'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { calculateBillTotals } from '#/lib/bill-calculations.ts'
import type { BillBreakdownInput } from '#/lib/bill-calculations.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import {
  clearStoredGuestParticipant,
  getStoredGuestSession,
} from '#/lib/guest-participant-session.ts'
import {
  sortGuestClaimItems,
  filterGuestClaimItemsBySearch,
  filterUnclaimedGuestClaimItems,
  filterClaimedGuestClaimItems,
} from '#/lib/guest-claim-items.ts'
import { GUEST_FLOW_MESSAGES } from '#/lib/guest-flow-messages.ts'
import { cn } from '#/lib/utils.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/claim')({
  head: () => buildNoIndexHead('Моят дял'),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === 'string' ? search.t : '',
    mode: search.mode === 'host' ? ('host' as const) : undefined,
  }),
  component: BillClaimPage,
})

function BillClaimPage() {
  const { billId: billIdParam } = Route.useParams()
  const { t: shareTokenFromUrl, mode } = Route.useSearch()
  const billId = billIdParam as Id<'bills'>

  if (mode === 'host') {
    return (
      <QueryErrorBoundary resetKey={`${billId}:host`}>
        <HostClaimContent billId={billId} />
      </QueryErrorBoundary>
    )
  }

  return (
    <QueryErrorBoundary resetKey={`${billId}:${shareTokenFromUrl}`}>
      <GuestClaimContent
        billId={billId}
        shareTokenFromUrl={shareTokenFromUrl}
      />
    </QueryErrorBoundary>
  )
}

function GuestClaimContent({
  billId,
  shareTokenFromUrl,
}: {
  billId: Id<'bills'>
  shareTokenFromUrl: string
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [itemTab, setItemTab] = useState<'remaining' | 'mine'>('remaining')

  const storedSession = useMemo(() => getStoredGuestSession(billId), [billId])
  const shareToken = storedSession?.shareToken ?? shareTokenFromUrl

  const data = useQuery(
    api.bills.getForGuest,
    shareToken
      ? {
          billId,
          shareToken,
          sessionToken: storedSession?.sessionToken,
        }
      : 'skip',
  )
  const pendingCover = useQuery(
    api.combinedPayments.getPendingCoverForGuest,
    shareToken && storedSession
      ? {
          billId,
          shareToken,
          sessionToken: storedSession.sessionToken,
        }
      : 'skip',
  )
  const releaseSession = useMutation(api.guestSessions.release)

  const redirectToJoin = useCallback(() => {
    void navigate({
      to: '/bills/$billId/join',
      params: { billId },
      search: shareToken ? { t: shareToken } : { t: '' },
    })
  }, [billId, navigate, shareToken])

  const handleSessionLost = useCallback(() => {
    if (storedSession && shareToken) {
      void releaseSession({
        billId,
        shareToken,
        sessionToken: storedSession.sessionToken,
      })
    }
    clearStoredGuestParticipant(billId)
    toast.error(GUEST_FLOW_MESSAGES.sessionLostRedirect)
    redirectToJoin()
  }, [billId, redirectToJoin, releaseSession, shareToken, storedSession])

  useGuestSessionHeartbeat(
    data?.bill.status === 'final' ? null : storedSession,
    handleSessionLost,
  )

  useEffect(() => {
    if (!shareToken) {
      redirectToJoin()
      return
    }
    if (storedSession === null && data !== undefined) {
      redirectToJoin()
    }
  }, [data, redirectToJoin, shareToken, storedSession])

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
        unitIndex: a.unitIndex,
      })),
      payments: data.myPayments.map((p) => ({
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
        unitIndex: a.unitIndex,
      })),
      tipCents: data.bill.tipCents ?? 0,
    }
  }, [data])

  const visibleItems = useMemo(() => {
    if (!data || !storedParticipantId) return []
    const sorted = sortGuestClaimItems(data.items)
    const participantId = storedParticipantId as Id<'participants'>
    const filtered =
      itemTab === 'mine'
        ? filterClaimedGuestClaimItems(sorted, data.assignments, participantId)
        : filterUnclaimedGuestClaimItems(
            sorted,
            data.assignments,
            participantId,
          )
    return filterGuestClaimItemsBySearch(filtered, search)
  }, [data, itemTab, search, storedParticipantId])

  const remainingCount = useMemo(() => {
    if (!data || !storedParticipantId) return 0
    return filterUnclaimedGuestClaimItems(
      data.items,
      data.assignments,
      storedParticipantId as Id<'participants'>,
    ).length
  }, [data, storedParticipantId])

  const claimedCount = useMemo(() => {
    if (!data || !storedParticipantId) return 0
    return filterClaimedGuestClaimItems(
      data.items,
      data.assignments,
      storedParticipantId as Id<'participants'>,
    ).length
  }, [data, storedParticipantId])

  const assignmentsByItemId = useMemo(() => {
    const map = new Map<Id<'items'>, Doc<'itemAssignments'>[]>()
    if (!data) return map
    for (const assignment of data.assignments) {
      const list = map.get(assignment.itemId) ?? []
      list.push(assignment)
      map.set(assignment.itemId, list)
    }
    return map
  }, [data?.assignments])

  const hasUnclaimedItems = remainingCount > 0

  if (
    !shareToken ||
    data === undefined ||
    storedParticipantId === null ||
    !storedSession
  ) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  const participant = data.participants.find(
    (p) => p._id === storedParticipantId,
  )
  if (!participant) {
    clearStoredGuestParticipant(billId)
    redirectToJoin()
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
      shareToken,
      sessionToken: storedSession.sessionToken,
    })
    clearStoredGuestParticipant(billId)
    redirectToJoin()
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

        {pendingCover ? (
          <CombinedCoverNotice
            payerName={pendingCover.payerName}
            coveredAmountCents={pendingCover.coveredAmountCents}
          />
        ) : null}

        {hasItems ? (
          <div
            className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-1"
            role="tablist"
            aria-label="Филтър на артикули"
          >
            <button
              type="button"
              role="tab"
              aria-selected={itemTab === 'remaining'}
              className={cn(
                'h-11 rounded-md text-sm font-medium transition-colors',
                itemTab === 'remaining'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
              onClick={() => setItemTab('remaining')}
            >
              Остават ({remainingCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={itemTab === 'mine'}
              className={cn(
                'h-11 rounded-md text-sm font-medium transition-colors',
                itemTab === 'mine'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
              onClick={() => setItemTab('mine')}
            >
              Мои ({claimedCount})
            </button>
          </div>
        ) : null}

        {(hasUnclaimedItems || itemTab === 'mine') && (
          <div className="relative z-10">
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
            <p className="text-sm text-muted-foreground">
              Все още няма артикули.
            </p>
          ) : visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasSearchQuery
                ? 'Няма артикули, съответстващи на търсенето.'
                : itemTab === 'mine'
                  ? 'Все още няма отбелязани артикули.'
                  : 'Всички артикули са отбелязани.'}
            </p>
          ) : (
            visibleItems.map((item) => (
              <GuestItemRow
                key={item._id}
                item={item}
                participantId={storedParticipantId as Id<'participants'>}
                sessionToken={storedSession.sessionToken}
                itemAssignments={assignmentsByItemId.get(item._id) ?? []}
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
          shareToken={shareToken}
          participantId={storedParticipantId as Id<'participants'>}
          sessionToken={storedSession.sessionToken}
          label={label}
          breakdownInput={breakdownInput}
          totals={participantTotals}
          participantBalances={data.participantBalances ?? []}
          participantLabels={labels}
          pendingCover={pendingCover ?? undefined}
          restaurantName={data.bill.restaurantName}
          readOnly={readOnly}
        />
      ) : null}
    </div>
  )
}

function HostClaimContent({ billId }: { billId: Id<'bills'> }) {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useRequireHostAuth(
    `/bills/${billId}/claim?mode=host`,
  )
  const [search, setSearch] = useState('')
  const [itemTab, setItemTab] = useState<'remaining' | 'mine'>('remaining')

  const data = useQuery(api.bills.get, isAuthenticated ? { billId } : 'skip')

  const redirectToEditor = useCallback(() => {
    void navigate({
      to: '/bills/$billId/',
      params: { billId },
      search: { step: 3 },
    })
  }, [billId, navigate])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    if (data === undefined) return
    if (!data.bill.hostParticipantId) {
      redirectToEditor()
    }
  }, [authLoading, data, isAuthenticated, redirectToEditor])

  const hostParticipantId = data?.bill.hostParticipantId ?? null

  const totals = useMemo(() => {
    if (!data || !hostParticipantId) return null
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
        unitIndex: a.unitIndex,
      })),
      payments: data.payments.map((p) => ({
        participantId: p.participantId,
        amountCents: p.amountCents,
      })),
      tipCents: data.bill.tipCents ?? 0,
      hostParticipantId,
    })
  }, [data, hostParticipantId])

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
        unitIndex: a.unitIndex,
      })),
      tipCents: data.bill.tipCents ?? 0,
    }
  }, [data])

  const visibleItems = useMemo(() => {
    if (!data || !hostParticipantId) return []
    const sorted = sortGuestClaimItems(data.items)
    const filtered =
      itemTab === 'mine'
        ? filterClaimedGuestClaimItems(
            sorted,
            data.assignments,
            hostParticipantId,
          )
        : filterUnclaimedGuestClaimItems(
            sorted,
            data.assignments,
            hostParticipantId,
          )
    return filterGuestClaimItemsBySearch(filtered, search)
  }, [data, hostParticipantId, itemTab, search])

  const remainingCount = useMemo(() => {
    if (!data || !hostParticipantId) return 0
    return filterUnclaimedGuestClaimItems(
      data.items,
      data.assignments,
      hostParticipantId,
    ).length
  }, [data, hostParticipantId])

  const claimedCount = useMemo(() => {
    if (!data || !hostParticipantId) return 0
    return filterClaimedGuestClaimItems(
      data.items,
      data.assignments,
      hostParticipantId,
    ).length
  }, [data, hostParticipantId])

  const assignmentsByItemId = useMemo(() => {
    const map = new Map<Id<'items'>, Doc<'itemAssignments'>[]>()
    if (!data) return map
    for (const assignment of data.assignments) {
      const list = map.get(assignment.itemId) ?? []
      list.push(assignment)
      map.set(assignment.itemId, list)
    }
    return map
  }, [data?.assignments])

  if (
    authLoading ||
    !isAuthenticated ||
    data === undefined ||
    !hostParticipantId
  ) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  const participant = data.participants.find((p) => p._id === hostParticipantId)
  if (!participant) {
    redirectToEditor()
    return null
  }

  const labels = buildParticipantLabels(data.participants)
  const label = labels[participant._id] ?? participant.name
  const readOnly = data.bill.status === 'final'
  const participantTotals = totals?.byParticipant[hostParticipantId]
  const hasItems = data.items.length > 0
  const hasSearchQuery = search.trim().length > 0
  const hasUnclaimedItems = remainingCount > 0

  return (
    <div className="page-container">
      <div className="flex flex-col gap-4 py-4 pb-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {data.bill.restaurantName.trim() || 'Сметка'}
          </p>
          <h2 className="text-lg font-semibold">Моите артикули</h2>
          <p className="text-sm text-muted-foreground">{label}</p>
          {readOnly && (
            <p className="text-sm text-muted-foreground">
              Сметката е приключена — само преглед.
            </p>
          )}
        </div>

        {hasItems ? (
          <div
            className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-1"
            role="tablist"
            aria-label="Филтър на артикули"
          >
            <button
              type="button"
              role="tab"
              aria-selected={itemTab === 'remaining'}
              className={cn(
                'h-11 rounded-md text-sm font-medium transition-colors',
                itemTab === 'remaining'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
              onClick={() => setItemTab('remaining')}
            >
              Остават ({remainingCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={itemTab === 'mine'}
              className={cn(
                'h-11 rounded-md text-sm font-medium transition-colors',
                itemTab === 'mine'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
              onClick={() => setItemTab('mine')}
            >
              Мои ({claimedCount})
            </button>
          </div>
        ) : null}

        {(hasUnclaimedItems || itemTab === 'mine') && (
          <div className="relative z-10">
            <Label htmlFor="host-claim-item-search" className="sr-only">
              Търсене по артикул
            </Label>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="host-claim-item-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Търсене по артикул"
              className="h-11 pl-9"
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {!hasItems ? (
            <p className="text-sm text-muted-foreground">
              Все още няма артикули.
            </p>
          ) : visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasSearchQuery
                ? 'Няма артикули, съответстващи на търсенето.'
                : itemTab === 'mine'
                  ? 'Все още няма отбелязани артикули.'
                  : 'Всички артикули са отбелязани.'}
            </p>
          ) : (
            visibleItems.map((item) => (
              <GuestItemRow
                key={item._id}
                item={item}
                participantId={hostParticipantId}
                itemAssignments={assignmentsByItemId.get(item._id) ?? []}
                participantLabels={labels}
                readOnly={readOnly}
                onItemSelected={() => setSearch('')}
              />
            ))
          )}
        </div>
      </div>

      {participantTotals && breakdownInput ? (
        <HostClaimFooter
          billId={billId}
          participantId={hostParticipantId}
          label={label}
          breakdownInput={breakdownInput}
          totals={participantTotals}
          participantLabels={labels}
          readOnly={readOnly}
        />
      ) : null}
    </div>
  )
}
