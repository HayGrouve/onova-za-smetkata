import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo } from 'react'
import { ClaimItemsPanel } from '#/components/bills/claim-items-panel.tsx'
import { GuestClaimFooter } from '#/components/bills/guest-claim-footer.tsx'
import { HostClaimFooter } from '#/components/bills/host-claim-footer.tsx'
import { CombinedCoverNotice } from '#/components/bills/combined-cover-notice.tsx'
import { Button } from '#/components/ui/button.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { useGuestClaimFlow } from '#/hooks/use-guest-claim-flow.ts'
import { useGuestClaimSession } from '#/hooks/use-guest-claim-session.ts'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
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

function mapClaimItems(items: Doc<'items'>[]) {
  return items.map((item) => ({
    id: item._id,
    name: item.name,
    quantity: item.quantity,
    sortOrder: item.sortOrder,
  }))
}

function mapClaimAssignments(assignments: Doc<'itemAssignments'>[]) {
  return assignments.map((assignment) => ({
    itemId: assignment.itemId,
    participantId: assignment.participantId,
    unitIndex: assignment.unitIndex,
  }))
}

function GuestClaimContent({
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
    participantLabel,
    readOnly,
    labels,
    itemDocsById,
    handleSwitchIdentity,
    itemTab,
    setItemTab,
    search,
    setSearch,
    clearSearch,
    session,
  } = useGuestClaimFlow(billId, shareTokenFromUrl)

  if (
    gate.status !== 'ready' ||
    !data ||
    !storedSession ||
    !participantId ||
    !participantLabel ||
    !session
  ) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  const shareDrawer = session.shareDrawer

  return (
    <div className="page-container">
      <div className="flex flex-col gap-4 py-4 pb-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {data.bill.restaurantName.trim() || 'Сметка'}
          </p>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Вие сте: {participantLabel}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSwitchIdentity}
            >
              Не съм {participantLabel}
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

        <ClaimItemsPanel
          session={session}
          itemTab={itemTab}
          onItemTabChange={setItemTab}
          search={search}
          onSearchChange={setSearch}
          searchInputId="claim-item-search"
          participantId={participantId}
          participants={data.participants.map((entry) => ({
            id: entry._id,
            sortOrder: entry.sortOrder,
          }))}
          sessionToken={storedSession.sessionToken}
          participantLabels={labels}
          readOnly={readOnly}
          onItemSelected={clearSearch}
          itemDocsById={itemDocsById}
        />
      </div>

      {shareDrawer ? (
        <GuestClaimFooter
          billId={billId}
          shareToken={shareToken}
          participantId={participantId}
          sessionToken={storedSession.sessionToken}
          label={participantLabel}
          breakdownInput={shareDrawer.breakdownInput}
          totals={shareDrawer.participantTotals}
          participantBalances={data.participantBalances}
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
  const labels = useMemo(
    () => (data ? buildParticipantLabels(data.participants) : {}),
    [data],
  )

  const { itemTab, setItemTab, search, setSearch, clearSearch, session } =
    useGuestClaimSession({
      items: data ? mapClaimItems(data.items) : [],
      assignments: data ? mapClaimAssignments(data.assignments) : [],
      participantId: hostParticipantId,
      billRelations:
        data && hostParticipantId
          ? {
              participants: data.participants,
              items: data.items,
              assignments: data.assignments,
              payments: data.payments,
            }
          : undefined,
      billContext:
        data && hostParticipantId
          ? {
              tipCents: data.bill.tipCents ?? 0,
              hostParticipantId,
            }
          : undefined,
      participantLabels: labels,
    })

  const itemDocsById = useMemo(() => {
    const map = new Map<string, Doc<'items'>>()
    if (!data) return map
    for (const item of data.items) {
      map.set(item._id, item)
    }
    return map
  }, [data?.items])

  if (
    authLoading ||
    !isAuthenticated ||
    data === undefined ||
    !hostParticipantId ||
    !session
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

  const label = labels[participant._id] ?? participant.name
  const readOnly = data.bill.status === 'final'
  const shareDrawer = session.shareDrawer

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

        <ClaimItemsPanel
          session={session}
          itemTab={itemTab}
          onItemTabChange={setItemTab}
          search={search}
          onSearchChange={setSearch}
          searchInputId="host-claim-item-search"
          participantId={hostParticipantId}
          participants={data.participants.map((entry) => ({
            id: entry._id,
            sortOrder: entry.sortOrder,
          }))}
          participantLabels={labels}
          readOnly={readOnly}
          onItemSelected={clearSearch}
          itemDocsById={itemDocsById}
        />
      </div>

      {shareDrawer ? (
        <HostClaimFooter
          billId={billId}
          participantId={hostParticipantId}
          label={label}
          breakdownInput={shareDrawer.breakdownInput}
          totals={shareDrawer.participantTotals}
          participantLabels={labels}
          readOnly={readOnly}
        />
      ) : null}
    </div>
  )
}
