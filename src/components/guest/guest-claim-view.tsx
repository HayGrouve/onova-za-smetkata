import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { ScissorsIcon, UserPlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { CombinedCoverNotice } from '#/components/bills/combined-cover-notice.tsx'
import { CoveredSeatsSheet } from '#/components/bills/covered-seats-sheet.tsx'
import { BillHeaderSlot } from '#/components/layout/bill-header-title.tsx'
import {
  DockHandle,
  useDockCollapsed,
} from '#/components/layout/dock-handle.tsx'
import { ClaimLine } from '#/components/receipt/claim-line.tsx'
import { FlightLayer, useFly } from '#/components/receipt/flight.tsx'
import { ClaimLineDrawer } from '#/components/receipt/line-drawer.tsx'
import type { LineActions } from '#/components/receipt/line-drawer.tsx'
import {
  LeaderRow,
  Receipt,
  ReceiptHeader,
  ReceiptTotals,
  RestaurantTitle,
  Rule,
} from '#/components/receipt/paper.tsx'
import {
  SeatAvatar,
  SeatsProvider,
  useSeatLookup,
} from '#/components/receipt/seats.tsx'
import { Stamp } from '#/components/receipt/stamp.tsx'
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
import { Button } from '#/components/ui/button.tsx'
import { useBillActivity } from '#/hooks/use-bill-activity.ts'
import { useClaimActions } from '#/hooks/use-claim-actions.ts'
import { useDockInset } from '#/hooks/use-dock-inset.ts'
import { useFlashError } from '#/hooks/use-flash-error.ts'
import { useGuestLiveReceipt } from '#/hooks/use-guest-live-receipt.ts'
import { buildCoveredSeatCandidates } from '#/lib/covered-seat-candidates.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { joinLabels } from '#/lib/participant-labels.ts'
import { getConvexErrorMessage } from '#/lib/convex-error.ts'
import { takenSeats } from '#/lib/guest-flow-session/guest-flow-session.ts'
import { cn } from '#/lib/utils.ts'
import type { ClaimGroup, UnitRef } from '../../../shared/claim-groups.ts'
import type { LiveReceiptSeat } from '../../../shared/live-receipt.ts'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

type GuestBillData = NonNullable<
  FunctionReturnType<typeof api.bills.getForGuest>
>

type ActiveSeats = FunctionReturnType<
  typeof api.guestSessions.listActiveForBill
>

export interface GuestClaimViewProps {
  billId: Id<'bills'>
  shareToken: string
  sessionToken: string
  data: GuestBillData
  participantId: Id<'participants'>
  mySeatIds: Id<'participants'>[]
  labels: Record<string, string>
  readOnly: boolean
  pendingCover: { payerName: string; coveredAmountCents: number } | null
  activeSeats: ActiveSeats | undefined
  onSwitchIdentity: () => void
}

/**
 * The guest's phone: the same receipt the host sees, with guest permissions.
 * Tap a line to take a Unit; your slip is pinned at the bottom.
 */
export function GuestClaimView(props: GuestClaimViewProps) {
  return (
    <SeatsProvider
      participants={props.data.participants}
      hostParticipantId={props.data.hostParticipantId}
    >
      <FlightLayer>
        <GuestClaimTable {...props} />
      </FlightLayer>
    </SeatsProvider>
  )
}

function GuestClaimTable({
  billId,
  shareToken,
  sessionToken,
  data,
  participantId,
  mySeatIds,
  labels,
  readOnly,
  pendingCover,
  activeSeats,
  onSwitchIdentity,
}: GuestClaimViewProps) {
  const navigate = useNavigate()
  const fly = useFly()
  const seatOf = useSeatLookup()
  const [activeId, setActiveId] = useState<string>(participantId)
  const actorId = (
    mySeatIds.includes(activeId as Id<'participants'>)
      ? activeId
      : participantId
  ) as Id<'participants'>
  const [openKey, setOpenKey] = useState<string | null>(null)
  const { lineError, flashError } = useFlashError()
  const [undo, pushUndo, clearUndo] = useUndo()
  const [coveredOpen, setCoveredOpen] = useState(false)
  const [dockCollapsed, toggleDock] = useDockCollapsed()
  const dockRef = useDockInset<HTMLDivElement>()
  const actions = useClaimActions({ seatId: actorId, sessionToken })
  const leaveUnit = useMutation(api.assignments.leaveUnit)
  const activeIds = useMemo(
    () => (activeSeats ?? []).map((seat) => seat.participantId as string),
    [activeSeats],
  )
  const receipt = useGuestLiveReceipt(data, activeSeats)
  const { lines: groups, membersOf, freeUnits, freeCents } = receipt
  const viewFor = receipt.lineFor
  const railSeats: RailSeat[] = toRailSeats(receipt.seats, seatOf)
  const transferSent = mySeatIds.some((id) => receipt.seat(id)?.sent)

  const events = useBillActivity({
    items: data.items,
    assignments: data.assignments,
    payments: data.myPayments,
    activeSeatIds: activeSeats === undefined ? undefined : activeIds,
    labels,
    quietSeatIds: mySeatIds,
  })
  const liveIds = new Set(
    events
      .slice(0, 2)
      .filter((event) => event.kind === 'took')
      .map((event) => event.seatId),
  )

  async function take(group: ClaimGroup) {
    if (readOnly) return
    const view = viewFor(group, actorId)
    if (view.freeUnits.length === 0) {
      flashError(
        group.key,
        'Всичко от реда е взето. Делихте ли? Задръжте реда.',
      )
      return
    }
    const ok = await actions.take(group.itemIds)
    if (!ok) return
    fly(actorId, group.key)
    const who =
      actorId === participantId ? 'Взехте' : `За ${labels[actorId] ?? 'друг'}:`
    pushUndo(`${who} ${group.name}`, () => {
      void actions.release(group.itemIds)
    })
  }

  /** Give back a Unit held by any of this phone's seats (own or Covered). */
  async function leaveAs(seatId: string, unit: UnitRef) {
    try {
      await leaveUnit({
        itemId: unit.itemId as Id<'items'>,
        unitIndex: unit.unitIndex,
        participantId: seatId as Id<'participants'>,
        sessionToken,
      })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  function lineActions(group: ClaimGroup): LineActions {
    return {
      busy: actions.busy,
      take: () => actions.take(group.itemIds),
      takeAll: async () => {
        // One Unit at a time (the server picks each); undo returns what landed.
        const free = viewFor(group, actorId).freeUnits.length
        let taken = 0
        for (let i = 0; i < free; i++) {
          if (!(await actions.take(group.itemIds))) break
          taken += 1
        }
        if (taken > 0) {
          pushUndo(`Взехте ${taken} × ${group.name}`, () => {
            void (async () => {
              for (let i = 0; i < taken; i++) {
                if (!(await actions.release(group.itemIds))) return
              }
            })()
          })
        }
        return taken === free
      },
      release: () => actions.release(group.itemIds),
      share: (withIds, unit) => actions.share(group.itemIds, withIds, unit),
      join: (unit) => actions.join(unit),
      leave: (unit) => actions.leave(unit),
    }
  }

  const coveredIds = mySeatIds.filter((id) => id !== participantId)
  const coveredCandidates = buildCoveredSeatCandidates({
    participants: data.participants,
    hostParticipantId: data.hostParticipantId,
    ownParticipantId: participantId,
    takenSeats: takenSeats(activeSeats, participantId),
    labels,
  })

  const meLabel = labels[participantId] ?? 'Участник'

  const slip = (
    <MySlip
      participantId={participantId}
      mySeatIds={mySeatIds}
      activeId={actorId}
      setActiveId={setActiveId}
      seatOf={receipt.seat}
      pending={transferSent}
      readOnly={readOnly}
      canCover={!readOnly && coveredCandidates.length > 0}
      hasCovered={coveredIds.length > 0}
      onCover={() => setCoveredOpen(true)}
      onTear={() =>
        void navigate({
          to: '/bills/$billId/pay',
          params: { billId },
          search: { t: shareToken },
          state: (prev) => ({ ...prev, fromReceipt: true }),
        })
      }
      undo={undo}
      clearUndo={clearUndo}
    />
  )

  return (
    <>
      <BillHeaderSlot>
        <div className="relative">
          <Timeline phase="table" final={readOnly} />
          {!readOnly ? (
            <TransientTicker latest={events[0]} className="lg:hidden" />
          ) : null}
        </div>
      </BillHeaderSlot>

      <div
        className={cn(
          'mx-auto grid w-full max-w-[1180px] items-start gap-6 px-3 pt-2 sm:px-6 md:grid-cols-[minmax(0,1fr)_320px] md:pb-24 lg:grid-cols-[240px_minmax(0,460px)_320px] lg:justify-center lg:gap-10 lg:pt-8',
          dockCollapsed ? 'pb-24' : 'pb-[250px]',
        )}
      >
        <aside className="sticky top-20 hidden space-y-6 lg:block">
          <section className="space-y-3" aria-label="Масата">
            <h2 className="text-[14px] font-bold">Масата</h2>
            <SeatsRail
              seats={railSeats}
              orientation="column"
              meId={participantId}
              liveIds={liveIds}
            />
          </section>
          <ActivityFeed events={events} />
        </aside>

        <div className="min-w-0">
          <div className="mb-2 lg:hidden">
            <SeatsRail
              seats={railSeats}
              label="Хората на масата"
              meId={participantId}
              liveIds={liveIds}
            />
          </div>
          {pendingCover ? (
            <div className="mb-3">
              <CombinedCoverNotice
                payerName={pendingCover.payerName}
                coveredAmountCents={pendingCover.coveredAmountCents}
              />
            </div>
          ) : null}
          <Receipt>
            <ReceiptHeader
              date={data.bill.date}
              title={<RestaurantTitle name={data.bill.restaurantName} />}
            >
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-muted">
                <span>
                  Вие сте <b className="text-ink">{meLabel}</b>.
                </span>
                <button
                  type="button"
                  className="min-h-11 underline decoration-dotted decoration-2 underline-offset-4"
                  onClick={onSwitchIdentity}
                >
                  Не съм {meLabel}
                </button>
              </p>
              <p className="text-[12px] leading-relaxed">
                {readOnly
                  ? 'Сметката е приключена. Само преглед.'
                  : 'Докоснете ред, за да вземете бройка. Задръжте го за делене и брой.'}
              </p>
            </ReceiptHeader>
            <Rule />
            {groups.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-ink-muted">
                Все още няма артикули. Бележката ще се напечата тук.
              </p>
            ) : (
              <ul>
                {groups.map((group) => (
                  <ClaimLine
                    key={group.key}
                    group={group}
                    membersOf={membersOf}
                    mode={readOnly ? 'readonly' : 'claim'}
                    highlightIds={mySeatIds}
                    countIds={[actorId]}
                    open={openKey === group.key}
                    error={lineError?.key === group.key ? lineError.text : null}
                    disabled={actions.busy}
                    tapLabel="Мое"
                    onTap={() => void take(group)}
                    onMore={() =>
                      setOpenKey(openKey === group.key ? null : group.key)
                    }
                    onReleaseUnit={(unit, seatId) => void leaveAs(seatId, unit)}
                    after={
                      <AnimatePresence initial={false}>
                        {openKey === group.key && !readOnly ? (
                          <ClaimLineDrawer
                            key={`drawer-${actorId}`}
                            group={group}
                            view={viewFor(group, actorId)}
                            actorId={actorId}
                            title={
                              actorId === participantId
                                ? group.name
                                : `${group.name}, за ${labels[actorId] ?? 'друг'}`
                            }
                            participants={receipt.seatOrder}
                            labels={labels}
                            actions={lineActions(group)}
                            onClose={() => setOpenKey(null)}
                          />
                        ) : null}
                      </AnimatePresence>
                    }
                  />
                ))}
              </ul>
            )}
            <Rule />
            <ReceiptTotals
              subtotalCents={receipt.subtotalCents}
              tipCents={receipt.tipCents}
            >
              {freeUnits > 0 ? (
                <LeaderRow
                  className="text-ink-muted"
                  label="Неотбелязани от никого"
                  value={`${freeUnits} бр., ${formatEur(freeCents)}`}
                />
              ) : null}
            </ReceiptTotals>
          </Receipt>
        </div>

        {/* One slip: pinned to the bottom on phones, a column beside the receipt wider up. */}
        <aside className="space-y-5 md:sticky md:top-20">
          <div
            ref={dockRef}
            className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background from-60% to-transparent pt-2 after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-background md:static md:z-auto md:bg-none md:pt-0 md:after:hidden"
          >
            <DockHandle
              collapsed={dockCollapsed}
              onToggle={toggleDock}
              label="Моята сметка"
              className={cn(
                dockCollapsed && 'pb-[max(10px,env(safe-area-inset-bottom))]',
              )}
            />
            <div className={cn(dockCollapsed && 'max-md:hidden')}>{slip}</div>
          </div>
          <div className="hidden md:block lg:hidden">
            <ActivityFeed events={events} limit={5} />
          </div>
        </aside>
      </div>

      <CoveredSeatsSheet
        open={coveredOpen}
        onOpenChange={setCoveredOpen}
        billId={billId}
        sessionToken={sessionToken}
        candidates={coveredCandidates}
        coveredIds={coveredIds}
      />
    </>
  )
}

/** The guest's own tear-off slip: running total, covered seats, tear to pay. */
function MySlip({
  participantId,
  mySeatIds,
  activeId,
  setActiveId,
  seatOf: moneyOf,
  pending,
  readOnly,
  canCover,
  hasCovered,
  onCover,
  onTear,
  undo,
  clearUndo,
}: {
  participantId: string
  mySeatIds: string[]
  activeId: string
  setActiveId: (id: string) => void
  /** Each of this phone's seats on the receipt: Share, what is left, Units. */
  seatOf: (id: string) => LiveReceiptSeat | undefined
  pending: boolean
  readOnly: boolean
  canCover: boolean
  hasCovered: boolean
  onCover: () => void
  onTear: () => void
  undo: UndoEntry | null
  clearUndo: () => void
}) {
  const reduce = useReducedMotion()
  const seatOf = useSeatLookup()
  const [tearing, setTearing] = useState(false)
  const sum = (pick: (seat: LiveReceiptSeat) => number) =>
    mySeatIds.reduce((total, id) => {
      const seat = moneyOf(id)
      return seat ? total + pick(seat) : total
    }, 0)
  const owed = sum((seat) => seat.owedCents)
  const remaining = sum((seat) => seat.remainingCents)
  const units = sum((seat) => seat.unitCount)
  const settled = owed > 0 && remaining === 0
  const anyPaid = remaining < owed && remaining > 0
  const activeSeat = seatOf(activeId)
  const amount = anyPaid ? remaining : owed

  function tear() {
    if (reduce) {
      onTear()
      return
    }
    setTearing(true)
  }

  return (
    <div className="space-y-2 px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:px-0 md:pb-0">
      <motion.div
        animate={
          tearing
            ? { y: -40, x: 24, rotate: -6, opacity: 0 }
            : { y: 0, x: 0, rotate: 0, opacity: 1 }
        }
        transition={
          tearing
            ? { duration: 0.45, ease: [0.5, 0, 0.7, 0.4] }
            : { duration: 0 }
        }
        onAnimationComplete={() => {
          if (tearing) {
            setTearing(false)
            onTear()
          }
        }}
        className="paper-shadow origin-top-left"
      >
        <div className="paper slip px-4 pb-4 md:pb-5">
          <div
            className="perf -mx-4 mb-1 flex items-center justify-center"
            aria-hidden
          >
            <ScissorsIcon
              className="relative z-10 size-3.5 -translate-y-px bg-paper px-0.5 text-ink-muted"
              strokeWidth={1.75}
            />
          </div>
          {mySeatIds.length > 1 ? (
            <div
              className="mb-2 flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Отбелязвате за"
            >
              <span className="text-[11px] text-ink-muted">Отбелязвам за</span>
              {mySeatIds.map((id) => {
                const seat = seatOf(id)
                if (!seat) return null
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activeId === id}
                    onClick={() => setActiveId(id)}
                    className={cn(
                      'flex min-h-11 items-center gap-1 rounded-full py-1 pr-2.5 pl-1 text-[12px]',
                      activeId === id
                        ? 'bg-ink font-semibold text-paper'
                        : 'hover:bg-paper-2',
                    )}
                  >
                    <SeatAvatar seat={seat} size="xs" />
                    {id === participantId ? 'мен' : seat.label}
                  </button>
                )
              })}
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            {activeSeat ? (
              <span data-seat-src={activeId} className="inline-flex">
                <SeatAvatar seat={activeSeat} size="md" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1 leading-tight">
              <span className="block text-[11px] text-ink-muted">
                {mySeatIds.length > 1
                  ? `Общо за ${joinLabels(mySeatIds.map((id) => seatOf(id)?.label ?? 'друг'))}`
                  : anyPaid
                    ? 'Остатък'
                    : 'Вашият дял'}
                , {units} бр.
              </span>
              <motion.span
                key={amount}
                initial={{ y: -6, opacity: 0.4 }}
                animate={{ y: 0, opacity: 1 }}
                className="block font-display text-[26px] font-bold"
                data-testid="claim-pay-bar-amount"
              >
                {formatEur(amount)}
              </motion.span>
            </div>
            <div className="relative">
              <AnimatePresence initial={false}>
                {settled ? (
                  <Stamp key="paid" className="text-[14px]">
                    Платено
                  </Stamp>
                ) : pending ? (
                  <Stamp key="wait" kind="wait" className="text-[13px]">
                    Чака
                  </Stamp>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
          {undo ? (
            <div className="mt-3">
              <UndoRow entry={undo} onDone={clearUndo} />
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              {canCover ? (
                <Button
                  type="button"
                  variant="outline"
                  className="size-12 shrink-0 px-0"
                  onClick={onCover}
                  aria-label={
                    hasCovered
                      ? 'Промени за кого плащате'
                      : 'Плащам и за някого'
                  }
                >
                  <UserPlusIcon
                    className="size-4"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </Button>
              ) : null}
              <Button
                type="button"
                size="lg"
                className="min-w-0 flex-1"
                disabled={owed === 0 && !readOnly}
                onClick={tear}
              >
                <ScissorsIcon
                  className="size-4"
                  strokeWidth={1.75}
                  aria-hidden
                />
                {readOnly
                  ? 'Разбивка'
                  : settled || pending
                    ? 'Виж плащането'
                    : 'Откъсни и плати'}
              </Button>
            </div>
          )}
          {owed === 0 && !readOnly ? (
            <p className="mt-2 text-[11px] text-ink-muted">
              Докоснете ред от бележката, за да започнете.
            </p>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
