import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { CheckIcon, UsersIcon } from 'lucide-react'
import { QuickActionBar } from '#/components/quick-bill/quick-layout.tsx'
import { ClaimLine } from '#/components/receipt/claim-line.tsx'
import { useFly } from '#/components/receipt/flight.tsx'
import { ClaimLineDrawer } from '#/components/receipt/line-drawer.tsx'
import type { LineActions } from '#/components/receipt/line-drawer.tsx'
import {
  LeaderRow,
  Receipt,
  ReceiptTotals,
  Rule,
} from '#/components/receipt/paper.tsx'
import { SeatAvatar, useSeatLookup } from '#/components/receipt/seats.tsx'
import { UndoRow, useUndo } from '#/components/receipt/table.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { editQuickBill } from '#/lib/quick-bill-storage.ts'
import {
  buildClaimGroupSeatView,
  indexUnitMembers,
  unitKey,
} from '../../../shared/claim-groups.ts'
import type { ClaimGroup, UnitRef } from '../../../shared/claim-groups.ts'
import {
  joinQuickBillUnit,
  leaveQuickBillUnit,
  quickBillClaimGroups,
  releaseQuickBillUnit,
  renameQuickBillSeat,
  setQuickBillLineForEveryone,
  shareQuickBillUnit,
  summarizeQuickBill,
  takeQuickBillUnit,
} from '../../../shared/quick-bill.ts'
import type { QuickBill, QuickBillSeat } from '../../../shared/quick-bill.ts'
import { PERSON_NAME_MAX } from '../../../shared/validation/constants.ts'

/**
 * One person's turn with the phone: their name, the receipt with tap-to-take
 * lines (the guest claim page, on one phone), and their running total.
 */
export function QuickTurn({
  bill,
  seat,
  labels,
  onDone,
  onNotMe,
}: {
  bill: QuickBill
  seat: QuickBillSeat
  labels: Record<string, string>
  onDone: () => void
  onNotMe: () => void
}) {
  const seatId = seat.id
  const seatOf = useSeatLookup()
  const fly = useFly()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [lineError, setLineError] = useState<{
    key: string
    text: string
  } | null>(null)
  const errorTimer = useRef<number | undefined>(undefined)
  const [undo, pushUndo, clearUndo] = useUndo()

  const groups = useMemo(() => quickBillClaimGroups(bill), [bill])
  const membersByUnit = useMemo(
    () => indexUnitMembers(bill.claims),
    [bill.claims],
  )
  const membersOf = (unit: UnitRef) => membersByUnit.get(unitKey(unit)) ?? []
  const participants = bill.seats.map((s, index) => ({
    id: s.id,
    sortOrder: index,
  }))
  const viewFor = (group: ClaimGroup) =>
    buildClaimGroupSeatView({
      group,
      assignments: bill.claims,
      seatId,
      participants,
    })

  const summary = summarizeQuickBill(bill)
  const mine = summary.seats.find((s) => s.id === seatId)
  const myUnits = bill.claims.filter((c) => c.participantId === seatId).length
  const everyoneLines = bill.lines.filter((line) => line.forEveryone)
  const label = labels[seatId] ?? `Човек ${seat.number}`
  const avatar = seatOf(seatId)

  function flashError(key: string, text: string) {
    setLineError({ key, text })
    window.clearTimeout(errorTimer.current)
    errorTimer.current = window.setTimeout(() => setLineError(null), 2800)
  }

  function take(group: ClaimGroup) {
    const result = editQuickBill((b) =>
      takeQuickBillUnit(b, group.itemIds, seatId),
    )
    if (!result.ok) {
      flashError(
        group.key,
        'Всичко от реда е взето. Делихте ли? Задръжте реда.',
      )
      return
    }
    fly(seatId, group.key)
    pushUndo(`Взехте ${group.name}`, () => {
      editQuickBill((b) => releaseQuickBillUnit(b, group.itemIds, seatId))
    })
  }

  function lineActions(group: ClaimGroup): LineActions {
    const run = (
      change: Parameters<typeof editQuickBill>[0],
    ): Promise<boolean> => Promise.resolve(editQuickBill(change).ok)
    return {
      busy: false,
      take: () => run((b) => takeQuickBillUnit(b, group.itemIds, seatId)),
      takeAll: () => {
        let taken = 0
        while (
          editQuickBill((b) => takeQuickBillUnit(b, group.itemIds, seatId)).ok
        ) {
          taken += 1
        }
        if (taken > 0) {
          pushUndo(`Взехте ${taken} × ${group.name}`, () => {
            for (let i = 0; i < taken; i++) {
              editQuickBill((b) =>
                releaseQuickBillUnit(b, group.itemIds, seatId),
              )
            }
          })
        }
        return Promise.resolve(true)
      },
      release: () => run((b) => releaseQuickBillUnit(b, group.itemIds, seatId)),
      share: (withIds, unit) =>
        run((b) => shareQuickBillUnit(b, group.itemIds, seatId, withIds, unit)),
      join: (unit) => run((b) => joinQuickBillUnit(b, unit, seatId)),
      leave: (unit) => run((b) => leaveQuickBillUnit(b, unit, seatId)),
    }
  }

  /** „За всички“ clears what anyone took from the line; undo puts it back. */
  function shareWithEveryone(group: ClaimGroup) {
    const onLine = (claim: QuickBill['claims'][number]) =>
      group.itemIds.includes(claim.itemId)
    const taken = bill.claims.filter(onLine)
    const setForEveryone = (b: QuickBill, on: boolean) =>
      group.itemIds.reduce(
        (next, lineId) => setQuickBillLineForEveryone(next, lineId, on),
        b,
      )
    editQuickBill((b) => setForEveryone(b, true))
    setOpenKey(null)
    pushUndo(`${group.name} е за всички`, () => {
      editQuickBill((b) => {
        const back = setForEveryone(b, false)
        return {
          ...back,
          claims: [...back.claims.filter((c) => !onLine(c)), ...taken],
        }
      })
    })
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[480px] px-3 pt-4 pb-[230px] sm:pt-8">
        <header className="flex items-center gap-3">
          {avatar ? <SeatAvatar seat={avatar} size="lg" /> : null}
          <div className="min-w-0 flex-1">
            <label
              htmlFor="quick-seat-name"
              className="block text-[11px] text-on-table-muted"
            >
              Ред е на
            </label>
            <Input
              id="quick-seat-name"
              value={seat.name}
              placeholder={`Човек ${seat.number}`}
              maxLength={PERSON_NAME_MAX}
              autoComplete="off"
              enterKeyHint="done"
              className="mt-1 h-11 font-display text-[17px] font-bold"
              onChange={(event) =>
                editQuickBill((b) =>
                  renameQuickBillSeat(b, seatId, event.target.value),
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
          </div>
        </header>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px] text-on-table-muted">
          <span>Напишете името си, ако искате.</span>
          <button
            type="button"
            className="min-h-11 underline decoration-dotted decoration-2 underline-offset-4"
            onClick={onNotMe}
          >
            Не съм {label}
          </button>
        </p>

        <Receipt className="mt-3">
          <p className="pt-3 text-[12px] leading-relaxed">
            Докоснете ред, за да вземете бройка. Задръжте го за делене и брой.
          </p>
          <Rule />
          {groups.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-ink-muted">
              Всички редове са за всички на масата.
            </p>
          ) : (
            <ul>
              {groups.map((group) => (
                <ClaimLine
                  key={group.key}
                  group={group}
                  membersOf={membersOf}
                  mode="claim"
                  highlightIds={[seatId]}
                  open={openKey === group.key}
                  error={lineError?.key === group.key ? lineError.text : null}
                  tapLabel="Мое"
                  onTap={() => take(group)}
                  onMore={() =>
                    setOpenKey(openKey === group.key ? null : group.key)
                  }
                  onReleaseUnit={(unit, holderId) =>
                    editQuickBill((b) => leaveQuickBillUnit(b, unit, holderId))
                  }
                  after={
                    <AnimatePresence initial={false}>
                      {openKey === group.key ? (
                        <div key={`drawer-${seatId}`}>
                          <ClaimLineDrawer
                            group={group}
                            view={viewFor(group)}
                            actorId={seatId}
                            title={group.name}
                            participants={participants}
                            labels={labels}
                            actions={lineActions(group)}
                            onClose={() => setOpenKey(null)}
                          />
                          <div className="flex flex-wrap items-center gap-2 border-l-[3px] border-ink bg-paper-2 px-3 pb-3">
                            <span className="min-w-0 flex-1 text-[12px]">
                              Цялата маса ли го дели?
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => shareWithEveryone(group)}
                            >
                              <UsersIcon aria-hidden />
                              За всички
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </AnimatePresence>
                  }
                />
              ))}
            </ul>
          )}

          {everyoneLines.length > 0 ? (
            <>
              <Rule />
              <h2 className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                За всички, поравно
              </h2>
              <ul className="mt-1 space-y-1 text-[12px]">
                {everyoneLines.map((line) => (
                  <li key={line.id} className="list-none">
                    <LeaderRow
                      label={line.name}
                      value={formatEur(line.unitPriceCents * line.quantity)}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <Rule />
          <ReceiptTotals subtotalCents={summary.linesCents} tipCents={0}>
            {summary.unassignedCents > 0 ? (
              <LeaderRow
                className="text-ink-muted"
                label="Неотбелязани от никого"
                value={`${summary.unassignedUnits} бр., ${formatEur(summary.unassignedCents)}`}
              />
            ) : null}
          </ReceiptTotals>
        </Receipt>
      </div>

      <QuickActionBar>
        <div className="paper-shadow">
          <div className="paper slip px-4 pb-4">
            <div className="perf -mx-4 mb-2" aria-hidden />
            <div className="flex items-center gap-3">
              {avatar ? (
                <span data-seat-src={seatId} className="inline-flex">
                  <SeatAvatar seat={avatar} size="md" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[11px] text-ink-muted">
                  {label}, {myUnits} бр.
                  {summary.tipCents > 0 ? ', с бакшиша' : ''}
                </span>
                <motion.span
                  key={mine?.shareCents}
                  initial={{ y: -6, opacity: 0.4 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="block font-display text-[26px] font-bold"
                  data-testid="quick-turn-total"
                >
                  {formatEur(mine?.shareCents ?? 0)}
                </motion.span>
              </div>
            </div>
            {undo ? (
              <div className="mt-3">
                <UndoRow entry={undo} onDone={clearUndo} />
              </div>
            ) : (
              <Button
                type="button"
                size="lg"
                className="mt-3 w-full"
                onClick={onDone}
              >
                <CheckIcon aria-hidden />
                Готово, подай нататък
              </Button>
            )}
          </div>
        </div>
      </QuickActionBar>
    </>
  )
}
