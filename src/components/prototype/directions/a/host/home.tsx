/** PROTOTYPE — Direction A host home: balance header, pending confirms, debtors, bills. */
import { useState } from 'react'
import {
  BellRingIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  ReceiptTextIcon,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { HOME_BILLS, HOST_PAYOUT } from '../../mock/data.ts'
import { formatEur, useProto } from '../../mock/store.tsx'
import {
  Avatar,
  AvatarStack,
  Btn,
  Group,
  GroupLabel,
  Money,
  Pill,
  RowMenu,
  STROKE,
  Skel,
  copyText,
  relTime,
  shortDate,
  useFlash,
} from '../ui.tsx'
import { billLink, statusPill } from './shared.tsx'
import type { BillStatus } from './shared.tsx'

interface HomeRow {
  id: string
  name: string
  date: number
  status: BillStatus
  totalCents: number
  outstandingCents: number
  people: number
  unassignedUnits: number
}

interface Debtor {
  key: string
  name: string
  cents: number
  billName: string
  billId: string
}

export function Home({
  pane,
  booting,
  empty,
  onToggleEmpty,
  selected,
  onOpenLive,
  onOpenStatic,
  onNew,
}: {
  pane: boolean
  booting: boolean
  empty: boolean
  onToggleEmpty: () => void
  selected: string | null
  onOpenLive: (tab?: 'items' | 'people' | 'payments') => void
  onOpenStatic: (id: string) => void
  onNew: () => void
}) {
  const { derived, dispatch } = useProto()
  const { bill } = derived
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [flashKey, flash] = useFlash()

  const liveName = bill.restaurantName || 'Нова сметка'
  const liveStatus: BillStatus =
    bill.status === 'final'
      ? 'final'
      : derived.guests.some((g) => g.joined) || derived.collectedCents > 0
        ? 'collecting'
        : 'draft'

  const rows: HomeRow[] = empty
    ? []
    : [
        {
          id: 'live',
          name: liveName,
          date: bill.date,
          status: liveStatus,
          totalCents: derived.totals.billTotalCents,
          outstandingCents: derived.outstandingCents,
          people: bill.participants.length,
          unassignedUnits: derived.unclaimedUnits,
        },
        ...HOME_BILLS.map((b): HomeRow => ({
          id: b._id,
          name: b.restaurantName ?? 'Без име',
          date: b.date,
          status:
            b.status === 'final'
              ? 'final'
              : b.guestCount > 0
                ? 'collecting'
                : 'draft',
          totalCents: b.totalCents,
          outstandingCents: b.outstandingCents,
          people: b.guestCount + 1,
          unassignedUnits: b.unassignedUnits,
        })),
      ]

  const debtors: Debtor[] = empty
    ? []
    : [
        ...derived.guests
          .filter(
            (g) =>
              g.remainingCents > 0 &&
              g.pendingCents === 0 &&
              g.claimedUnits > 0,
          )
          .map((g) => ({
            key: `live-${g.participantId}`,
            name: g.name,
            cents: g.remainingCents,
            billName: liveName,
            billId: 'live',
          })),
        ...HOME_BILLS.flatMap((b) =>
          b.debtors.map((d) => ({
            key: `${b._id}-${d.name}`,
            name: d.name,
            cents: d.cents,
            billName: b.restaurantName ?? 'Без име',
            billId: b._id,
          })),
        ),
      ]
  const owedTotal =
    debtors.reduce((s, d) => s + d.cents, 0) +
    (empty ? 0 : derived.pendingCents)
  const pending = empty ? [] : bill.pending
  const billCount = new Set(debtors.map((d) => d.billId)).size

  const active = rows.filter((r) => r.status !== 'draft' || r.id === 'live')
  const drafts = rows.filter((r) => r.status === 'draft' && r.id !== 'live')

  function open(id: string) {
    if (id === 'live') onOpenLive()
    else onOpenStatic(id)
  }

  return (
    <div
      className={cn('mx-auto w-full pb-16', pane ? 'max-w-none' : 'max-w-xl')}
    >
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between px-4">
        <span className="text-[15px] font-semibold tracking-[-0.01em]">
          Онова за сметката
        </span>
        <RowMenu
          label="Профил"
          items={[
            {
              label: empty
                ? 'Покажи примерните сметки'
                : 'Прототип: празен профил',
              onSelect: onToggleEmpty,
            },
          ]}
        />
      </div>

      {/* Balance header */}
      <section className="px-4 pt-2 pb-5">
        <p className="text-[13px] font-medium text-(--a-muted)">Дължат ви</p>
        {booting ? (
          <Skel className="mt-2 h-9 w-40" />
        ) : (
          <p className="mt-1 text-[32px] leading-none font-semibold tracking-[-0.02em]">
            <Money cents={owedTotal} />
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          {debtors.length > 0 ? (
            <>
              <AvatarStack
                names={debtors.map((d) => d.name)}
                max={5}
                size={26}
              />
              <span className="text-[13px] text-(--a-muted)">
                {debtors.length === 1 ? '1 човек' : `${debtors.length} души`} в{' '}
                {billCount === 1 ? '1 сметка' : `${billCount} сметки`}
              </span>
            </>
          ) : (
            <span className="text-[13px] text-(--a-muted)">
              Никой не ви дължи. Чисто.
            </span>
          )}
        </div>
        <Btn size="lg" className="mt-5 w-full" onClick={onNew}>
          <PlusIcon strokeWidth={STROKE} />
          Нова сметка
        </Btn>
      </section>

      <div className="flex flex-col gap-6 px-4">
        {booting ? (
          <HomeSkeleton />
        ) : rows.length === 0 ? (
          <EmptyHome />
        ) : (
          <>
            {pending.length > 0 && (
              <section>
                <GroupLabel>Чакат потвърждение</GroupLabel>
                <Group>
                  {pending.map((p) => {
                    const name = derived.labels[p.participantId] ?? 'Някой'
                    const by =
                      p.byParticipantId !== p.participantId
                        ? derived.labels[p.byParticipantId]
                        : null
                    return (
                      <div
                        key={p.participantId}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <Avatar name={name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium">
                            {name}{' '}
                            <Money
                              cents={p.amountCents}
                              className="font-semibold"
                            />
                          </p>
                          <p className="truncate text-[13px] text-(--a-muted)">
                            {by ? `Плати ${by}` : 'Натисна „Платих“'},{' '}
                            {relTime(p.reportedAt)}
                          </p>
                        </div>
                        <Btn
                          size="sm"
                          onClick={() =>
                            dispatch({
                              type: 'confirmPayment',
                              participantId: p.participantId,
                            })
                          }
                        >
                          <CheckIcon strokeWidth={2} />
                          Потвърди
                        </Btn>
                      </div>
                    )
                  })}
                </Group>
              </section>
            )}

            {debtors.length > 0 && (
              <section>
                <GroupLabel>Кой дължи</GroupLabel>
                <Group>
                  {debtors.slice(0, 5).map((d) => (
                    <div
                      key={d.key}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <Avatar name={d.name} />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => open(d.billId)}
                      >
                        <p className="truncate text-[15px] font-medium">
                          {d.name}
                        </p>
                        <p className="truncate text-[13px] text-(--a-muted)">
                          {d.billName}
                        </p>
                      </button>
                      <Money
                        cents={d.cents}
                        className="text-[15px] font-semibold"
                      />
                      <Btn
                        size="sm"
                        variant="ghost"
                        aria-label={`Напомни на ${d.name}`}
                        onClick={() => {
                          copyText(
                            `Здрасти, ${d.name}! Остават ти ${formatEur(d.cents)} за ${d.billName}. Revolut: @${HOST_PAYOUT.revolutTag} ${billLink(d.billId)}`,
                          )
                          flash(d.key)
                        }}
                        className={pane ? 'w-9 px-0' : 'w-[104px]'}
                      >
                        {flashKey === d.key ? (
                          <CheckIcon strokeWidth={2} />
                        ) : (
                          <BellRingIcon strokeWidth={STROKE} />
                        )}
                        {!pane && (flashKey === d.key ? 'Копирано' : 'Напомни')}
                      </Btn>
                    </div>
                  ))}
                </Group>
              </section>
            )}

            <section>
              <GroupLabel>Сметки</GroupLabel>
              <Group>
                {active.map((r) => (
                  <BillRow
                    key={r.id}
                    row={r}
                    compact={pane}
                    selected={selected === r.id}
                    onClick={() => open(r.id)}
                  />
                ))}
                {drafts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftsOpen((o) => !o)}
                    aria-expanded={draftsOpen}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-(--a-muted) hover:bg-(--a-surface-2)"
                  >
                    <span className="flex-1">
                      Чернови{' '}
                      <span className="tabular-nums">({drafts.length})</span>
                    </span>
                    <ChevronDownIcon
                      strokeWidth={STROKE}
                      className={cn(
                        'size-[18px] transition-transform',
                        draftsOpen && 'rotate-180',
                      )}
                    />
                  </button>
                )}
                {draftsOpen &&
                  drafts.map((r) => (
                    <BillRow
                      key={r.id}
                      row={r}
                      compact={pane}
                      selected={selected === r.id}
                      onClick={() => open(r.id)}
                    />
                  ))}
              </Group>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function BillRow({
  row,
  compact,
  selected,
  onClick,
}: {
  row: HomeRow
  compact: boolean
  selected: boolean
  onClick: () => void
}) {
  const pill = statusPill(row.status)
  const sub =
    row.status === 'collecting' && row.outstandingCents > 0
      ? null
      : row.status === 'draft' && row.unassignedUnits > 0
        ? `${row.unassignedUnits} неразпределени`
        : null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected || undefined}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--a-surface-2)',
        selected && 'bg-(--a-accent-soft) hover:bg-(--a-accent-soft)',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-medium">{row.name}</p>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-(--a-muted)">
          {shortDate(row.date)},{' '}
          {row.people === 1 ? 'само вие' : `${row.people} души`}
          {sub ? `, ${sub}` : ''}
        </p>
        {compact && (
          <Pill tone={pill.tone} className="mt-1.5">
            {pill.label}
          </Pill>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        {row.status === 'collecting' && row.outstandingCents > 0 && compact ? (
          <Money
            cents={row.outstandingCents}
            className="text-[15px] font-semibold"
          />
        ) : row.status === 'collecting' && row.outstandingCents > 0 ? (
          <span className="text-[13px] text-(--a-muted)">
            остават{' '}
            <Money
              cents={row.outstandingCents}
              className="font-semibold text-(--a-text)"
            />
          </span>
        ) : (
          <Money cents={row.totalCents} className="text-[15px] font-semibold" />
        )}
        {!compact && <Pill tone={pill.tone}>{pill.label}</Pill>}
      </div>
      <ChevronRightIcon
        strokeWidth={STROKE}
        className="size-4 shrink-0 text-(--a-muted)"
      />
    </button>
  )
}

function HomeSkeleton() {
  return (
    <div>
      <Skel className="mb-3 h-4 w-20" />
      <Group>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1">
              <Skel className="h-4 w-36" />
              <Skel className="mt-2 h-3 w-24" />
            </div>
            <Skel className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </Group>
    </div>
  )
}

function EmptyHome() {
  return (
    <div className="flex flex-col items-center rounded-[14px] border border-dashed border-(--a-field) px-6 py-10 text-center">
      <ReceiptTextIcon
        strokeWidth={STROKE}
        className="size-8 text-(--a-muted)"
      />
      <p className="mt-3 text-[17px] font-semibold">Още нямате сметки</p>
      <p className="mt-1 max-w-[30ch] text-[15px] text-(--a-muted)">
        Снимайте бележката от ресторанта и пратете линка на масата. Всеки
        отбелязва своето.
      </p>
    </div>
  )
}
