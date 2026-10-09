import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRightIcon,
  ChevronDownIcon,
  LockIcon,
  SplitIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { CombinedPaymentBanner } from '#/components/bills/combined-payment-banner.tsx'
import { ParticipantDetailSheet } from '#/components/bills/participant-detail-sheet.tsx'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { useActiveSeats } from '#/hooks/use-active-seats.ts'
import { BillHeaderSlot } from '#/components/layout/bill-header-title.tsx'
import {
  DockHandle,
  useDockCollapsed,
} from '#/components/layout/dock-handle.tsx'
import {
  HostSlip,
  SlipStack,
  sortSlips,
} from '#/components/host/host-slips.tsx'
import type { HostSlipModel } from '#/components/host/host-slips.tsx'
import { HostUnitDrawer } from '#/components/host/host-unit-drawer.tsx'
import { LinkStub } from '#/components/host/link-stub.tsx'
import { ClaimLine } from '#/components/receipt/claim-line.tsx'
import { FlightLayer, useFly } from '#/components/receipt/flight.tsx'
import {
  ReceiptHeader,
  ReceiptTotals,
  RestaurantTitle,
  Rule,
} from '#/components/receipt/paper.tsx'
import { SeatsProvider, useSeatLookup } from '#/components/receipt/seats.tsx'
import {
  ActivityFeed,
  SeatsRail,
  TransientTicker,
  UndoRow,
  toRailSeats,
  useUndo,
} from '#/components/receipt/table.tsx'
import type { RailSeat, UndoEntry } from '#/components/receipt/table.tsx'
import { Timeline } from '#/components/receipt/timeline.tsx'
import type { Phase } from '#/components/receipt/timeline.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { useBillActivity } from '#/hooks/use-bill-activity.ts'
import { buildBillJoinUrl, resolveAppOrigin } from '#/lib/bill-join-url.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { GuidanceTarget } from '#/lib/guidance-focus/guidance-target.tsx'
import { getConvexErrorMessage } from '#/lib/convex-error.ts'
import type { GuidanceFocusHandle } from '#/lib/guidance-focus/use-guidance-focus.ts'
import { navigateToFinalBillSummary } from '#/lib/navigate-to-final-bill-summary.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { cn } from '#/lib/utils.ts'
import {
  calculateBillTotals,
  validateBillForFinalize,
} from '../../../shared/bill-calculations.ts'
import { toBillCalculationSnapshot } from '../../../shared/bill-calculation-snapshot.ts'
import type { ClaimGroup, UnitRef } from '../../../shared/claim-groups.ts'
import {
  buildLiveReceipt,
  buildSeatLedger,
} from '../../../shared/live-receipt.ts'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export type HostBillData = NonNullable<FunctionReturnType<typeof api.bills.get>>

/** What Сглобяване puts on the paper; only the editor provides it. */
export interface AssembleSlots {
  /** Restaurant name field (replaces the printed title). */
  title: ReactNode
  /** Lines, tip and the people at the table. */
  body: ReactNode
  /** The phase's main action (step-aware: Към хората, Сложи я на масата). */
  primary: { label: string; onClick: () => void; ready: boolean }
  blockers: string[]
  /** Increments to replay the onboarding "next" pop on the primary button. */
  popToken?: number
  onPopEnd?: () => void
}

export interface HostBillViewProps {
  billId: Id<'bills'>
  data: HostBillData
  phase: Phase
  onPhase?: (phase: Phase) => void
  /** Present on the editor; absent on the read-only summary. */
  assemble?: AssembleSlots
  /** Onboarding: sharing is intercepted by the payment checkpoint. */
  onShareLink?: (joinUrl: string) => Promise<boolean>
  /** Onboarding focus: the share stub and the lines to allocate. */
  guidanceFocus?: GuidanceFocusHandle
  /** Onboarding bar, shown under the header. */
  guidance?: ReactNode
}

/**
 * The Host's phone: one living receipt moving through Сглобяване, На масата
 * and Разплащане. People are seats around the table; on На масата a seat is
 * the brush that paints lines; payments land as stamps on the slips.
 */
export function HostBillView(props: HostBillViewProps) {
  return (
    <SeatsProvider
      participants={props.data.participants}
      hostParticipantId={props.data.bill.hostParticipantId}
    >
      <FlightLayer>
        <HostBillTable {...props} />
      </FlightLayer>
    </SeatsProvider>
  )
}

function HostBillTable({
  billId,
  data,
  phase,
  onPhase,
  assemble,
  onShareLink,
  guidanceFocus,
  guidance,
}: HostBillViewProps) {
  const { bill, participants, items, assignments, payments } = data
  const final = bill.status === 'final'
  const seatOf = useSeatLookup()
  const fly = useFly()
  const takeUnit = useMutation(api.assignments.takeUnit)
  const releaseUnit = useMutation(api.assignments.releaseUnit)
  const pendingRequests = useQuery(
    api.combinedPayments.listPendingForBill,
    final ? 'skip' : { billId },
  )
  const activeSeats = useActiveSeats(
    billId,
    final ? undefined : bill.shareToken,
  )
  const { openPaymentSettings } = usePaymentSettingsSheet()
  const [brushId, setBrushId] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [lineError, setLineError] = useState<{
    key: string
    text: string
  } | null>(null)
  const errorTimer = useRef<number | undefined>(undefined)
  const [undo, pushUndo, clearUndo] = useUndo()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [dockCollapsed, toggleDock] = useDockCollapsed()
  const activePhase: Phase | 'final' = final ? 'final' : phase
  const assembling = activePhase === 'assemble' && assemble !== undefined

  const labels = useMemo(
    () => buildParticipantLabels(participants),
    [participants],
  )
  const snapshot = useMemo(
    () =>
      toBillCalculationSnapshot(
        { participants, items, assignments, payments },
        {
          tipCents: bill.tipCents ?? 0,
          hostParticipantId: bill.hostParticipantId,
        },
      ),
    [participants, items, assignments, payments, bill],
  )
  const totals = useMemo(
    () => calculateBillTotals(snapshot.calculationInput),
    [snapshot],
  )
  const activeIds = useMemo(
    () => (activeSeats ?? []).map((seat) => seat.participantId as string),
    [activeSeats],
  )
  const receipt = useMemo(
    () =>
      buildLiveReceipt({
        participants,
        items,
        assignments,
        tipCents: bill.tipCents,
        hostParticipantId: bill.hostParticipantId,
        seatMoney: buildSeatLedger({
          totals,
          sentRequests: pendingRequests ?? [],
        }),
        joinedSeatIds: activeIds,
      }),
    [
      participants,
      items,
      assignments,
      bill,
      totals,
      pendingRequests,
      activeIds,
    ],
  )
  const { membersOf, freeUnits, freeCents } = receipt
  const railSeats: RailSeat[] = toRailSeats(receipt.seats, seatOf)

  const slips: HostSlipModel[] = receipt.seats.map((seat, index) => ({
    seat: railSeats[index].seat,
    status: seat.status,
    totals: totals.byParticipant[seat.id],
    units: seat.unitCount,
    pending: seat.sent
      ? {
          requestId: seat.sent.requestId as Id<'combinedPaymentRequests'>,
          totalCents: seat.sent.totalCents,
          payerId: seat.sent.payerId,
          payerLabel: labels[seat.sent.payerId] ?? 'друг',
        }
      : null,
  }))

  const events = useBillActivity({
    items,
    assignments,
    payments,
    activeSeatIds: final
      ? []
      : activeSeats === undefined
        ? undefined
        : activeIds,
    labels,
    quietSeatIds: bill.hostParticipantId ? [bill.hostParticipantId] : [],
  })
  const liveIds = new Set(
    events
      .slice(0, 2)
      .filter((event) => event.kind === 'took')
      .map((event) => event.seatId),
  )

  const joinUrl =
    typeof window !== 'undefined' && bill.shareToken
      ? buildBillJoinUrl(
          billId,
          resolveAppOrigin(window.location.origin),
          bill.shareToken,
        )
      : null

  function flashError(key: string, text: string) {
    setLineError({ key, text })
    window.clearTimeout(errorTimer.current)
    errorTimer.current = window.setTimeout(() => setLineError(null), 2800)
  }

  async function paint(group: ClaimGroup) {
    const brush = brushId ? seatOf(brushId) : undefined
    if (!brush) {
      setOpenKey((key) => (key === group.key ? null : group.key))
      return
    }
    if (group.units.every((unit) => membersOf(unit).length > 0)) {
      flashError(
        group.key,
        'Всичко от реда е взето. Задръжте реда, за да разделите бройка.',
      )
      return
    }
    const args = {
      itemIds: group.itemIds as Id<'items'>[],
      participantId: brush.id as Id<'participants'>,
    }
    try {
      await takeUnit(args)
      fly(brush.id, group.key)
      pushUndo(`${brush.label} взе ${group.name}`, () => {
        void releaseUnit(args).catch((error: unknown) =>
          toast.error(getConvexErrorMessage(error)),
        )
      })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  const finalizeErrors = validateBillForFinalize({
    ...snapshot.calculationInput,
    restaurantName: bill.restaurantName,
  })

  const lines = assembling ? (
    assemble.body
  ) : (
    <LineList
      groups={receipt.lines}
      membersOf={membersOf}
      participants={receipt.seatOrder}
      phase={activePhase}
      brushId={brushId}
      openKey={openKey}
      setOpenKey={setOpenKey}
      onPaint={(group) => void paint(group)}
      lineError={lineError}
      freeUnits={freeUnits}
      onBackToAssemble={onPhase ? () => onPhase('assemble') : undefined}
    />
  )

  const hostName = bill.hostParticipantId
    ? labels[bill.hostParticipantId]
    : undefined

  const paper = (
    <div className="relative">
      <div className="paper-shadow">
        <div className="paper paper-top thermal relative px-4 pb-4 sm:px-6">
          <ReceiptHeader
            date={bill.date}
            right={hostName ? `Маса на ${hostName}` : undefined}
            title={
              assembling ? (
                assemble.title
              ) : (
                <RestaurantTitle name={bill.restaurantName} />
              )
            }
          >
            {!assembling && !final ? (
              <LinkStub
                billId={billId}
                shareToken={bill.shareToken}
                readOnly={final}
                onShareLink={onShareLink}
                shareGuidance={guidanceFocus}
              />
            ) : null}
            {bill.note && !assembling ? (
              <p className="mt-2 text-[12px] text-ink-muted">{bill.note}</p>
            ) : null}
          </ReceiptHeader>
          <Rule />
          {guidanceFocus && activePhase === 'table' ? (
            <GuidanceTarget stepId="allocation" focus={guidanceFocus}>
              {lines}
            </GuidanceTarget>
          ) : (
            lines
          )}
          <Rule />
          <ReceiptTotals
            subtotalCents={receipt.subtotalCents}
            tipCents={receipt.tipCents}
          >
            {freeUnits > 0 && !assembling ? (
              <div className="flex items-baseline text-ink-muted">
                <span>Неразпределени</span>
                <span className="leader" aria-hidden />
                <span>
                  {freeUnits} бр., {formatEur(freeCents)}
                </span>
              </div>
            ) : null}
          </ReceiptTotals>
          <AnimatePresence>
            {final ? (
              <motion.div
                initial={{ scale: 1.6, rotate: -18, opacity: 0 }}
                animate={{ scale: 1, rotate: -10, opacity: 0.9 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="pointer-events-none absolute inset-x-0 top-24 flex justify-center"
              >
                <span className="stamp rotate-0! bg-paper/50 px-4 text-[30px] sm:text-[36px]">
                  Приключена
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        {/* Slips continue the paper on phones; wider screens give them a column. */}
        <div className={cn('paper', assembling ? 'hidden' : 'md:hidden')}>
          <SlipStack
            billId={billId}
            slips={slips}
            big={activePhase !== 'table'}
            readOnly={final}
            restaurantName={bill.restaurantName}
            joinUrl={joinUrl}
            onOpen={setDetailId}
          />
        </div>
        <div className="paper-end" aria-hidden />
      </div>
    </div>
  )

  const actions = (
    <PhaseActions
      billId={billId}
      phase={activePhase}
      assemble={assemble}
      onPhase={onPhase}
      undo={undo}
      clearUndo={clearUndo}
      freeUnits={freeUnits}
      freeCents={freeCents}
      seatCount={participants.length}
      outstandingCents={receipt.outstandingCents}
      unpaid={slips.filter(
        (slip) => slip.status === 'owes' || slip.status === 'pending',
      )}
      finalizeErrors={finalizeErrors
        // Unpaid people are listed one by one below instead.
        .filter((error) => error.code !== 'unpaid_participants')
        .map((error) => error.message)}
    />
  )

  const brushable = activePhase === 'table'
  const toggleBrush = (id: string) =>
    setBrushId((current) => (current === id ? null : id))

  return (
    <>
      <BillHeaderSlot>
        <div className="relative">
          <Timeline
            phase={phase}
            final={final}
            onPhase={final ? undefined : onPhase}
          />
          {activePhase === 'table' ? (
            <TransientTicker latest={events[0]} className="lg:hidden" />
          ) : null}
        </div>
      </BillHeaderSlot>
      {guidance}

      <div
        className={cn(
          'mx-auto grid w-full max-w-[1180px] items-start gap-6 px-3 pt-3 sm:px-6',
          'md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[240px_minmax(0,460px)_300px] lg:justify-center lg:gap-10 lg:pt-8',
          dockCollapsed ? 'pb-24' : 'pb-[240px] md:pb-24',
        )}
      >
        <aside className="sticky top-20 hidden space-y-6 lg:block">
          <TableColumn
            seats={railSeats}
            hostId={bill.hostParticipantId}
            liveIds={liveIds}
            brushId={brushable ? brushId : null}
            onSeat={brushable ? toggleBrush : undefined}
            hint={brushable}
          />
          {activePhase !== 'assemble' ? <ActivityFeed events={events} /> : null}
        </aside>

        <main className="min-w-0">{paper}</main>

        {/*
          One copy of the actions: a dock pinned to the bottom on phones (with
          the seats as the brush picker), a column beside the receipt wider up.
          The dock's colour bleeds below its edge: edge-to-edge Android can
          scroll the page behind the gesture bar, under a bottom-0 element.
        */}
        <aside className="space-y-5 md:sticky md:top-20">
          <div className="hidden md:block lg:hidden">
            <TableColumn
              seats={railSeats}
              hostId={bill.hostParticipantId}
              liveIds={liveIds}
              brushId={brushable ? brushId : null}
              onSeat={brushable ? toggleBrush : undefined}
              hint={brushable}
            />
          </div>
          <div className="fixed inset-x-0 bottom-0 z-40 after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-table-2 md:static md:z-auto md:after:hidden">
            <div className="space-y-2 rounded-t-[26px] bg-table-2 px-3 pt-1 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-16px_40px_-20px_var(--paper-shadow)] md:rounded-none md:bg-transparent md:p-0 md:shadow-none">
              <DockHandle
                collapsed={dockCollapsed}
                onToggle={toggleDock}
                label="Действия"
              />
              {activePhase === 'table' || activePhase === 'assemble' ? (
                <div className={cn('md:hidden', dockCollapsed && 'hidden')}>
                  <SeatsRail
                    seats={railSeats}
                    meId={bill.hostParticipantId}
                    liveIds={liveIds}
                    brushId={brushable ? brushId : null}
                    onSeat={brushable ? toggleBrush : undefined}
                    onAdd={
                      activePhase === 'assemble'
                        ? () =>
                            document
                              .getElementById('bill-people')
                              ?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start',
                              })
                        : undefined
                    }
                    label={brushable ? 'Изберете човек' : 'Хората на масата'}
                  />
                </div>
              ) : null}
              <div className={cn(dockCollapsed && 'max-md:hidden')}>
                {actions}
              </div>
            </div>
          </div>
          {!assembling ? (
            <div className="hidden space-y-3 md:block">
              {sortSlips(slips).map((slip) => (
                <div key={slip.seat.id} className="paper-lift">
                  <div className="paper stub px-4">
                    <HostSlip
                      billId={billId}
                      slip={slip}
                      big={activePhase !== 'table'}
                      readOnly={final}
                      restaurantName={bill.restaurantName}
                      joinUrl={joinUrl}
                      onOpen={() => setDetailId(slip.seat.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {activePhase !== 'assemble' ? (
            <div className="hidden md:block lg:hidden">
              <ActivityFeed events={events} limit={5} />
            </div>
          ) : null}
        </aside>
      </div>

      {detailId ? (
        <ParticipantDetailSheet
          open
          onOpenChange={(open) => {
            if (!open) setDetailId(null)
          }}
          billId={billId}
          participantId={detailId as Id<'participants'>}
          label={labels[detailId] ?? 'Участник'}
          breakdownInput={receipt.breakdownInput}
          totals={totals.byParticipant[detailId]}
          payments={payments}
          onOpenPaymentSettings={openPaymentSettings}
          showPaymentActions={detailId !== bill.hostParticipantId}
          paymentActionsReadOnly={final}
          showPayActions={false}
        />
      ) : null}
    </>
  )
}

function LineList({
  groups,
  membersOf,
  participants,
  phase,
  brushId,
  openKey,
  setOpenKey,
  onPaint,
  lineError,
  freeUnits,
  onBackToAssemble,
}: {
  groups: ClaimGroup[]
  membersOf: (unit: UnitRef) => string[]
  participants: Array<{ id: string; sortOrder: number }>
  phase: Phase | 'final'
  brushId: string | null
  openKey: string | null
  setOpenKey: (key: string | null) => void
  onPaint: (group: ClaimGroup) => void
  lineError: { key: string; text: string } | null
  freeUnits: number
  onBackToAssemble?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const collapsed = (phase === 'settle' || phase === 'final') && !expanded
  const totalUnits = groups.reduce((sum, group) => sum + group.units.length, 0)

  if (groups.length === 0) {
    return (
      <div className="py-6 text-center text-[12px] text-ink-muted">
        <p>Бележката е празна.</p>
        {onBackToAssemble ? (
          <Button
            type="button"
            variant="link"
            className="mt-1"
            onClick={onBackToAssemble}
          >
            Към Сглобяване
          </Button>
        ) : null}
      </div>
    )
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex min-h-12 w-full items-center justify-between gap-3 text-left text-[12px]"
      >
        <span>
          {groups.length} реда, {totalUnits} бройки
          {freeUnits > 0 ? `, ${freeUnits} неразпределени` : ''}
        </span>
        <span className="flex items-center gap-1 font-semibold">
          Покажи
          <ChevronDownIcon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
      </button>
    )
  }

  const mode = phase === 'table' ? (brushId ? 'paint' : 'inspect') : 'readonly'
  return (
    <ul>
      {groups.map((group) => (
        <ClaimLine
          key={group.key}
          group={group}
          membersOf={membersOf}
          mode={mode}
          highlightIds={brushId ? [brushId] : []}
          open={openKey === group.key}
          error={lineError?.key === group.key ? lineError.text : null}
          onTap={mode === 'readonly' ? undefined : () => onPaint(group)}
          onMore={
            mode === 'readonly'
              ? undefined
              : () => setOpenKey(openKey === group.key ? null : group.key)
          }
          after={
            <AnimatePresence initial={false}>
              {openKey === group.key && mode !== 'readonly' ? (
                <HostUnitDrawer
                  key="drawer"
                  group={group}
                  membersOf={membersOf}
                  participants={participants}
                  onClose={() => setOpenKey(null)}
                />
              ) : null}
            </AnimatePresence>
          }
        />
      ))}
    </ul>
  )
}

/** Desktop and tablet: the table column (seats as the brush picker). */
function TableColumn({
  seats,
  hostId,
  liveIds,
  brushId,
  onSeat,
  hint,
}: {
  seats: RailSeat[]
  hostId: string | undefined
  liveIds: Set<string>
  brushId: string | null
  onSeat?: (id: string) => void
  hint: boolean
}) {
  return (
    <section aria-label="Масата" className="space-y-3">
      <h2 className="text-[14px] font-bold">Масата</h2>
      {hint ? (
        <p className="text-[11px] leading-snug text-on-table-muted">
          Изберете човек, после докосвайте редовете му.
        </p>
      ) : null}
      <SeatsRail
        seats={seats}
        orientation="column"
        meId={hostId}
        liveIds={liveIds}
        brushId={brushId}
        onSeat={onSeat}
        label={onSeat ? 'Изберете човек' : undefined}
      />
    </section>
  )
}

function Box({ children, tight }: { children: ReactNode; tight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[22px] bg-table md:bg-table-2',
        tight ? 'px-3 py-2' : 'p-3',
      )}
    >
      {children}
    </div>
  )
}

function PhaseActions({
  billId,
  phase,
  assemble,
  onPhase,
  undo,
  clearUndo,
  freeUnits,
  freeCents,
  seatCount,
  outstandingCents,
  unpaid,
  finalizeErrors,
}: {
  billId: Id<'bills'>
  phase: Phase | 'final'
  assemble?: AssembleSlots
  onPhase?: (phase: Phase) => void
  undo: UndoEntry | null
  clearUndo: () => void
  freeUnits: number
  freeCents: number
  seatCount: number
  outstandingCents: number
  unpaid: HostSlipModel[]
  finalizeErrors: string[]
}) {
  const navigate = useNavigate()
  const assignAll = useMutation(api.assignments.assignAll)
  const finalizeBill = useMutation(api.bills.finalize)
  const { confirm } = useConfirmAction()
  const [triedNext, setTriedNext] = useState(false)
  const [busy, setBusy] = useState(false)

  if (phase === 'final') {
    return (
      <Box>
        <p className="flex items-center gap-2 text-[12px]">
          <LockIcon className="size-4" strokeWidth={1.75} aria-hidden />
          Сметката е приключена и заключена.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-2 w-full"
          onClick={() => void navigate({ to: '/' })}
        >
          Към сметките
        </Button>
      </Box>
    )
  }

  if (phase === 'assemble' && assemble) {
    const showBlockers = triedNext && assemble.blockers.length > 0
    return (
      <Box>
        {showBlockers ? (
          <ul
            className="mb-2 space-y-0.5 text-[12px] font-semibold"
            role="alert"
          >
            {assemble.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={assemble.primary.ready ? 'default' : 'outline'}
            className={cn(
              'w-full',
              (assemble.popToken ?? 0) > 0 && 'content-route-choice-pop',
            )}
            key={assemble.popToken}
            onAnimationEnd={(event) => {
              if (event.animationName === 'content-route-choice-pop') {
                assemble.onPopEnd?.()
              }
            }}
            onClick={() => {
              setTriedNext(true)
              if (assemble.primary.ready) assemble.primary.onClick()
            }}
          >
            {assemble.primary.label}
            <ArrowRightIcon className="size-4" strokeWidth={2} aria-hidden />
          </Button>
        </div>
      </Box>
    )
  }

  async function splitRest() {
    const confirmed = await confirm({
      title: 'Раздели неразпределеното поравно?',
      description: `Свободните бройки (${freeUnits} бр., ${formatEur(freeCents)}) се делят поравно между всички ${seatCount} на масата. Вече отбелязаните бройки остават както са.`,
      confirmLabel: 'Раздели поравно',
      variant: 'default',
    })
    if (!confirmed) return
    setBusy(true)
    try {
      await assignAll({ billId, mode: 'unassigned_only' })
      toast.success('Неразпределеното е разделено поравно')
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function finalize() {
    const confirmed = await confirm({
      title: 'Приключване на сметката?',
      description:
        'Всички са платили. След приключване бележката се заключва: артикулите и плащанията не могат да се променят.',
      confirmLabel: 'Приключи',
      variant: 'default',
    })
    if (!confirmed) return
    setBusy(true)
    try {
      await finalizeBill({ billId })
      toast.success('Сметката е приключена')
      await navigateToFinalBillSummary(navigate, billId)
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <CombinedPaymentBanner billId={billId} />

      {phase === 'table' ? (
        <Box tight>
          {undo ? (
            <UndoRow entry={undo} onDone={clearUndo} />
          ) : freeUnits > 0 ? (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 leading-tight">
                <span className="block text-[11px] text-on-table-muted">
                  Неразпределени
                </span>
                <span className="font-display text-[15px] font-bold">
                  {freeUnits} бр. <span className="text-on-table-muted">/</span>{' '}
                  {formatEur(freeCents)}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={busy || seatCount === 0}
                onClick={() => void splitRest()}
              >
                <SplitIcon className="size-4" strokeWidth={1.75} aria-hidden />
                Раздели поравно
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-[12px] leading-snug">
                Всичко е разпределено.
              </span>
              <Button type="button" onClick={() => onPhase?.('settle')}>
                Към разплащане
                <ArrowRightIcon
                  className="size-4"
                  strokeWidth={2}
                  aria-hidden
                />
              </Button>
            </div>
          )}
          <p className="mt-1 hidden pb-1 text-[11px] leading-snug text-on-table-muted md:block">
            Гостите отбелязват сами от линка. Вие довършвате с избрания човек.
          </p>
        </Box>
      ) : null}

      {phase === 'settle' ? (
        <Box tight>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 leading-tight">
              <span className="block text-[11px] text-on-table-muted">
                Остават
              </span>
              <span className="font-display text-[18px] font-bold">
                {formatEur(outstandingCents)}
              </span>
            </div>
            <Button
              type="button"
              disabled={busy || finalizeErrors.length > 0 || unpaid.length > 0}
              onClick={() => void finalize()}
            >
              Приключи
            </Button>
          </div>
          {finalizeErrors.length > 0 || unpaid.length > 0 ? (
            <ul className="mt-1 space-y-0.5 pb-1 text-[11px] leading-snug text-on-table-muted">
              {finalizeErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
              {unpaid.map((slip) => (
                <li key={slip.seat.id}>
                  {slip.seat.label}{' '}
                  {slip.status === 'pending'
                    ? 'чака вашето потвърждение'
                    : `дължи ${formatEur(Math.max(0, slip.totals.balanceCents))}`}
                  .
                </li>
              ))}
            </ul>
          ) : null}
        </Box>
      ) : null}
    </div>
  )
}
