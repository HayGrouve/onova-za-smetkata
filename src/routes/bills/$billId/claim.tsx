import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { UserPlusIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClaimHint } from '#/components/bills/claim-hint.tsx'
import { ClaimItemsPanel } from '#/components/bills/claim-items-panel.tsx'
import { ClaimPayBar } from '#/components/bills/claim-pay-bar.tsx'
import { CombinedCoverNotice } from '#/components/bills/combined-cover-notice.tsx'
import { CoveredSeatsSheet } from '#/components/bills/covered-seats-sheet.tsx'
import { GuestStepsBar } from '#/components/bills/guest-steps-bar.tsx'
import { SeatSwitcher } from '#/components/bills/seat-switcher.tsx'
import { Button } from '#/components/ui/button.tsx'
import { QueryErrorBoundary } from '#/components/ui/query-error-boundary.tsx'
import { useGuestBillSession } from '#/hooks/use-guest-bill-session.ts'
import { useGuestClaimSession } from '#/hooks/use-guest-claim-session.ts'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { ICON } from '#/lib/app-icons.ts'
import { buildCoveredSeatCandidates } from '#/lib/covered-seat-candidates.ts'
import { buildParticipantLabels, joinLabels } from '#/lib/participant-labels.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import {
  buildTakenSeats,
  mapGuestBillToClaimSessionInput,
} from '../../../../shared/guest-flow-session.ts'
import type { GuestClaimSeatShare } from '../../../../shared/guest-claim-session.ts'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/claim')({
  head: () => buildNoIndexHead('Моят дял'),
  validateSearch: (
    search: Record<string, unknown>,
  ): { t?: string; mode?: 'host' } => ({
    t: typeof search.t === 'string' ? search.t : '',
    mode: search.mode === 'host' ? ('host' as const) : undefined,
  }),
  component: BillClaimPage,
})

const EMPTY_ITEMS: never[] = []

function BillClaimPage() {
  const { billId: billIdParam } = Route.useParams()
  const { t: shareTokenFromUrl = '', mode } = Route.useSearch()
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

/** What the seats still have to pay: share before any payment, then the rest. */
function payableCents(shares: GuestClaimSeatShare[]): number {
  return shares.reduce(
    (sum, share) =>
      sum +
      (share.totals.paidCents > 0
        ? Math.max(0, share.totals.balanceCents)
        : share.totals.owedCents),
    0,
  )
}

function sortedShareCandidates(
  participants: Doc<'participants'>[],
  seatId: string,
  labels: Record<string, string>,
) {
  return [...participants]
    .filter((participant) => participant._id !== seatId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((participant) => ({
      id: participant._id,
      label: labels[participant._id] ?? participant.name,
    }))
}

function LoadingState() {
  return (
    <div className="page-container py-10 text-center text-muted-foreground">
      Зареждане...
    </div>
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
    handleSwitchIdentity,
  } = useGuestBillSession(billId, shareTokenFromUrl)
  const activeSeats = useQuery(
    api.guestSessions.listActiveForBill,
    shareToken ? { billId, shareToken } : 'skip',
  )
  const [activeSeatId, setActiveSeatId] = useState<string | null>(null)
  const [coveredSheetOpen, setCoveredSheetOpen] = useState(false)

  const seatId =
    activeSeatId && mySeatIds.includes(activeSeatId as Id<'participants'>)
      ? (activeSeatId as Id<'participants'>)
      : participantId

  const claimInput = useMemo(
    () => (data ? mapGuestBillToClaimSessionInput(data) : null),
    [data],
  )

  const { itemTab, setItemTab, search, setSearch, session } =
    useGuestClaimSession({
      items: claimInput?.items ?? EMPTY_ITEMS,
      assignments: claimInput?.assignments ?? EMPTY_ITEMS,
      participants: claimInput?.participants ?? EMPTY_ITEMS,
      seatId,
      mySeatIds,
      billRelations: claimInput?.billRelations,
      billContext: claimInput?.billContext,
    })

  if (
    gate.status !== 'ready' ||
    !data ||
    !claimInput ||
    !storedSession ||
    !participantId ||
    !seatId ||
    !session
  ) {
    return <LoadingState />
  }

  const participantLabel = labels[participantId] ?? 'Участник'
  const seats = mySeatIds.map((id) => ({
    id,
    label: labels[id] ?? 'Участник',
  }))
  const coveredIds = mySeatIds.filter((id) => id !== participantId)
  const coveredCandidates = buildCoveredSeatCandidates({
    participants: data.participants,
    hostParticipantId: data.hostParticipantId,
    ownParticipantId: participantId,
    takenSeats: buildTakenSeats(activeSeats, participantId),
    labels,
  })

  const amountCents = payableCents(session.seatShares)
  const anyPaid = session.seatShares.some((share) => share.totals.paidCents > 0)
  const payLabel =
    seats.length > 1
      ? `Общо за ${joinLabels(seats.map((seat) => seat.label))}`
      : anyPaid
        ? 'Остатък'
        : 'Вашият дял'
  const freeUnits = session.tableProgress.freeUnits

  return (
    <div className="page-container">
      <div className="flex flex-col gap-4 py-4">
        <GuestStepsBar step={2} />

        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {data.bill.restaurantName.trim() || 'Сметка'}
          </p>
          <h2 className="text-lg font-semibold">Какво консумирахте?</h2>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">
              Вие сте: <span className="font-medium">{participantLabel}</span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSwitchIdentity}
            >
              Не съм {participantLabel}
            </Button>
          </div>
          {readOnly ? (
            <p className="text-sm text-muted-foreground">
              Сметката е приключена — само преглед.
            </p>
          ) : null}
        </div>

        {pendingCover ? (
          <CombinedCoverNotice
            payerName={pendingCover.payerName}
            coveredAmountCents={pendingCover.coveredAmountCents}
          />
        ) : null}

        {seats.length > 1 ? (
          <SeatSwitcher
            seats={seats}
            activeSeatId={seatId}
            onChange={setActiveSeatId}
          />
        ) : null}

        {!readOnly && coveredCandidates.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-10 w-fit justify-start text-primary"
            onClick={() => setCoveredSheetOpen(true)}
          >
            <UserPlusIcon className={ICON.button} aria-hidden />
            {coveredIds.length > 0
              ? 'Промени за кого плащате'
              : 'Плащате и за някого?'}
          </Button>
        ) : null}

        {!readOnly ? <ClaimHint /> : null}

        <ClaimItemsPanel
          session={session}
          itemTab={itemTab}
          onItemTabChange={setItemTab}
          search={search}
          onSearchChange={setSearch}
          searchInputId="claim-item-search"
          seatId={seatId}
          participants={claimInput.participants}
          participantLabels={labels}
          shareCandidates={sortedShareCandidates(
            data.participants,
            seatId,
            labels,
          )}
          sessionToken={storedSession.sessionToken}
          readOnly={readOnly}
        />
      </div>

      <ClaimPayBar
        label={payLabel}
        amountCents={amountCents}
        actionLabel={readOnly ? 'Разбивка' : 'Към плащане'}
        onAction={() =>
          void navigate({
            to: '/bills/$billId/pay',
            params: { billId },
            search: { t: shareToken },
          })
        }
        note={
          !readOnly && freeUnits > 0
            ? `${freeUnits} ${freeUnits === 1 ? 'бройка още не е отбелязана' : 'бройки още не са отбелязани'} от никого.`
            : undefined
        }
      />

      <CoveredSeatsSheet
        open={coveredSheetOpen}
        onOpenChange={setCoveredSheetOpen}
        billId={billId}
        shareToken={shareToken}
        sessionToken={storedSession.sessionToken}
        candidates={coveredCandidates}
        coveredIds={coveredIds}
      />
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
      to: '/bills/$billId',
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

  const claimInput = useMemo(
    () =>
      data
        ? mapGuestBillToClaimSessionInput({
            bill: data.bill,
            hostParticipantId: data.bill.hostParticipantId,
            participants: data.participants,
            items: data.items,
            assignments: data.assignments,
            myPayments: data.payments,
          })
        : null,
    [data],
  )

  const { itemTab, setItemTab, search, setSearch, session } =
    useGuestClaimSession({
      items: claimInput?.items ?? EMPTY_ITEMS,
      assignments: claimInput?.assignments ?? EMPTY_ITEMS,
      participants: claimInput?.participants ?? EMPTY_ITEMS,
      seatId: hostParticipantId,
      billRelations: claimInput?.billRelations,
      billContext: claimInput?.billContext,
    })

  if (
    authLoading ||
    !isAuthenticated ||
    data === undefined ||
    !claimInput ||
    !hostParticipantId ||
    !session
  ) {
    return <LoadingState />
  }

  const participant = data.participants.find((p) => p._id === hostParticipantId)
  if (!participant) {
    redirectToEditor()
    return null
  }

  const label = labels[participant._id] ?? participant.name
  const readOnly = data.bill.status === 'final'
  const owedCents = session.seatShares[0]?.totals.owedCents ?? 0

  return (
    <div className="page-container">
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {data.bill.restaurantName.trim() || 'Сметка'}
          </p>
          <h2 className="text-lg font-semibold">Моите артикули</h2>
          <p className="text-sm text-muted-foreground">{label}</p>
          {readOnly ? (
            <p className="text-sm text-muted-foreground">
              Сметката е приключена — само преглед.
            </p>
          ) : null}
        </div>

        <ClaimItemsPanel
          session={session}
          itemTab={itemTab}
          onItemTabChange={setItemTab}
          search={search}
          onSearchChange={setSearch}
          searchInputId="host-claim-item-search"
          seatId={hostParticipantId}
          participants={claimInput.participants}
          participantLabels={labels}
          shareCandidates={sortedShareCandidates(
            data.participants,
            hostParticipantId,
            labels,
          )}
          readOnly={readOnly}
        />
      </div>

      <ClaimPayBar
        label="Вашият дял"
        amountCents={owedCents}
        actionLabel="Към сметката"
        onAction={redirectToEditor}
        note="Покрито като домакин — не плащате на себе си."
      />
    </div>
  )
}
