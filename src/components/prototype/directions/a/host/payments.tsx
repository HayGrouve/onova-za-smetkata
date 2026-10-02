/**
 * PROTOTYPE — Direction A „Плащания“: money first. Pending transfers on top
 * with one-tap Потвърди, then compact rows (remaining €, status pill, row
 * menu), then finish with inline blockers and „Приключи с остатък“.
 * Rendered as a tab on phones/tablets and as a right rail at ≥1280.
 */
import { useState } from 'react'
import {
  BellRingIcon,
  CheckCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  LockIcon,
  PartyPopperIcon,
  Undo2Icon,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { HOST_PAYOUT } from '../../mock/data.ts'
import { formatEur, useProto } from '../../mock/store.tsx'
import {
  Avatar,
  Btn,
  Confirm,
  Group,
  GroupLabel,
  IconBtn,
  Meter,
  Money,
  Pill,
  RowMenu,
  STROKE,
  copyText,
  relTime,
  useFlash,
} from '../ui.tsx'
import { SEAT_PILL, billLink, seatPayState } from './shared.tsx'
import { SplitRestConfirm } from './items.tsx'

export function PaymentsPanel({
  rail,
  onGoItems,
}: {
  rail?: boolean
  onGoItems: () => void
}) {
  const { derived, dispatch } = useProto()
  const { bill } = derived
  const locked = bill.status === 'final'
  const [flashKey, flash] = useFlash()
  const [finishOpen, setFinishOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)

  const owedByGuests = derived.guests.reduce(
    (s, g) => s + g.totals.owedCents,
    0,
  )
  const due = derived.guests.filter((g) =>
    ['due', 'idle'].includes(seatPayState(g)),
  )
  const host = derived.seats.find((s) => s.isHost)
  const order = { pending: 0, due: 1, idle: 2, paid: 3, none: 4 } as const
  const rows = [...derived.guests].sort(
    (a, b) => order[seatPayState(a)] - order[seatPayState(b)],
  )

  const blockers: Array<{
    key: string
    text: React.ReactNode
    action?: React.ReactNode
  }> = []
  if (derived.unclaimedUnits > 0)
    blockers.push({
      key: 'units',
      text: (
        <>
          {derived.unclaimedUnits === 1
            ? '1 бройка'
            : `${derived.unclaimedUnits} бройки`}{' '}
          без собственик, <Money cents={derived.unclaimedCents} />
        </>
      ),
      action: (
        <Btn size="sm" variant="ghost" onClick={() => setSplitOpen(true)}>
          Раздели
        </Btn>
      ),
    })
  if (bill.pending.length > 0)
    blockers.push({
      key: 'pending',
      text:
        bill.pending.length === 1
          ? '1 плащане чака потвърждение'
          : `${bill.pending.length} плащания чакат потвърждение`,
    })
  if (due.length > 0)
    blockers.push({
      key: 'due',
      text: (
        <>
          {due.length === 1 ? '1 човек' : `${due.length} души`} още дължат{' '}
          <Money cents={due.reduce((s, g) => s + g.remainingCents, 0)} />
        </>
      ),
    })

  if (bill.participants.length < 2) {
    return (
      <div className={cn(rail && 'p-5')}>
        {rail && (
          <h2 className="mb-4 text-[17px] font-semibold tracking-[-0.01em]">
            Плащания
          </h2>
        )}
        <p className="rounded-[14px] bg-(--a-surface-2) p-4 text-[15px] text-(--a-muted)">
          Тук ще виждате кой е платил. Първо добавете хора и артикули.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', rail && 'p-5')}>
      {rail && (
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">
          Плащания
        </h2>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px]">
            Събрани{' '}
            <Money cents={derived.collectedCents} className="font-semibold" />
          </p>
          <p className="text-[13px] text-(--a-muted)">
            от <Money cents={owedByGuests} />
          </p>
        </div>
        <Meter
          className="mt-2"
          value={derived.collectedCents}
          max={owedByGuests}
        />
      </div>

      {bill.pending.length > 0 && (
        <section>
          <GroupLabel>Чакат потвърждение</GroupLabel>
          <Group className="border-[color-mix(in_oklch,var(--a-pending-strong)_55%,transparent)]">
            {bill.pending.map((p) => {
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
                    <p className="truncate text-[15px] font-medium">{name}</p>
                    <p className="truncate text-[13px] text-(--a-muted)">
                      {by ? `Плати ${by}` : 'Натисна „Платих“'},{' '}
                      {relTime(p.reportedAt)}
                    </p>
                  </div>
                  <Money
                    cents={p.amountCents}
                    className="text-[15px] font-semibold"
                  />
                  {!locked && (
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
                  )}
                </div>
              )
            })}
          </Group>
        </section>
      )}

      <section>
        <GroupLabel>Хора</GroupLabel>
        <Group>
          {rows.map((g) => {
            const st = seatPayState(g)
            const pill = SEAT_PILL[st]
            const remindText = `Здрасти, ${g.name}! Остават ти ${formatEur(g.remainingCents)} за ${bill.restaurantName || 'сметката'}. Revolut: @${HOST_PAYOUT.revolutTag} https://${billLink(bill._id)}`
            return (
              <div
                key={g.participantId}
                className="flex items-center gap-3 py-2.5 pr-2 pl-4"
              >
                <Avatar name={g.name} muted={st === 'paid' || st === 'none'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{g.name}</p>
                  <Pill
                    tone={pill.tone}
                    dot={st !== 'none'}
                    className="mt-1 h-5 px-2 text-[11px]"
                  >
                    {pill.label}
                  </Pill>
                </div>
                <div className="text-right">
                  <Money
                    cents={
                      st === 'paid'
                        ? g.totals.paidCents
                        : st === 'pending'
                          ? g.pendingCents
                          : g.remainingCents
                    }
                    className={cn(
                      'text-[15px] font-semibold',
                      st !== 'due' && st !== 'pending' && 'text-(--a-muted)',
                    )}
                  />
                  {st === 'due' && g.totals.paidCents > 0 && (
                    <p className="text-[12px] text-(--a-muted)">
                      платил <Money cents={g.totals.paidCents} />
                    </p>
                  )}
                </div>
                {!locked && (st === 'due' || st === 'idle') && (
                  <IconBtn
                    label={`Напомни на ${g.name}`}
                    className="size-9 text-(--a-accent)"
                    onClick={() => {
                      copyText(remindText)
                      flash(g.participantId)
                    }}
                  >
                    {flashKey === g.participantId ? (
                      <CheckIcon strokeWidth={2} />
                    ) : (
                      <BellRingIcon strokeWidth={STROKE} />
                    )}
                  </IconBtn>
                )}
                {!locked && (
                  <RowMenu
                    label={`Още за ${g.name}`}
                    items={
                      st === 'paid'
                        ? [
                            {
                              label: 'Отмени плащането',
                              icon: <Undo2Icon strokeWidth={STROKE} />,
                              onSelect: () =>
                                dispatch({
                                  type: 'undoPayment',
                                  participantId: g.participantId,
                                }),
                            },
                          ]
                        : st === 'pending'
                          ? [
                              {
                                label: 'Потвърди плащането',
                                icon: <CheckIcon strokeWidth={STROKE} />,
                                onSelect: () =>
                                  dispatch({
                                    type: 'confirmPayment',
                                    participantId: g.participantId,
                                  }),
                              },
                              {
                                label: 'Не е получено',
                                icon: <Undo2Icon strokeWidth={STROKE} />,
                                danger: true,
                                onSelect: () =>
                                  dispatch({
                                    type: 'cancelReport',
                                    participantIds: [g.participantId],
                                  }),
                              },
                            ]
                          : [
                              {
                                label: 'Отбележи платено',
                                icon: <CheckIcon strokeWidth={STROKE} />,
                                disabled: st === 'none',
                                onSelect: () =>
                                  dispatch({
                                    type: 'markPaid',
                                    participantId: g.participantId,
                                  }),
                              },
                              {
                                label: 'Копирай напомняне',
                                icon: <BellRingIcon strokeWidth={STROKE} />,
                                disabled: st === 'none',
                                onSelect: () => {
                                  copyText(remindText)
                                  flash(g.participantId)
                                },
                              },
                            ]
                    }
                  />
                )}
              </div>
            )
          })}
        </Group>
        {host && host.totals.owedCents > 0 && (
          <p className="mt-2 px-1 text-[13px] text-(--a-muted)">
            Вашият дял е <Money cents={host.totals.owedCents} />. Той не се
            събира.
          </p>
        )}
      </section>

      {/* Finish */}
      <section>
        {locked ? (
          <div className="flex items-start gap-3 rounded-[14px] bg-(--a-surface-2) p-4">
            <LockIcon
              strokeWidth={STROKE}
              className="mt-0.5 size-5 shrink-0 text-(--a-muted)"
            />
            <div className="flex-1">
              <p className="text-[15px] font-semibold">Сметката е приключена</p>
              <p className="text-[13px] text-(--a-muted)">
                {derived.outstandingCents > 0 ? (
                  <>
                    Остатъкът <Money cents={derived.outstandingCents} /> остава
                    на началния екран, докато не го съберете.
                  </>
                ) : (
                  'Всичко е събрано.'
                )}
              </p>
              <Btn
                size="sm"
                variant="ghost"
                className="mt-1 -ml-3"
                onClick={() => dispatch({ type: 'reopen' })}
              >
                Отключи
              </Btn>
            </div>
          </div>
        ) : blockers.length === 0 ? (
          <div className="rounded-[14px] border border-(--a-hairline) bg-(--a-surface) p-4 text-center">
            <PartyPopperIcon
              strokeWidth={STROKE}
              className="mx-auto size-7 text-(--a-paid)"
            />
            <p className="mt-2 text-[17px] font-semibold">Всички са платили</p>
            <p className="text-[13px] text-(--a-muted)">
              Събрахте <Money cents={derived.collectedCents} />. Приключете, за
              да заключите сметката.
            </p>
            <Btn
              size="lg"
              className="mt-4 w-full"
              onClick={() => dispatch({ type: 'finalize' })}
            >
              <CheckCheckIcon strokeWidth={STROKE} />
              Приключи сметката
            </Btn>
          </div>
        ) : (
          <div>
            <GroupLabel>Преди да приключите</GroupLabel>
            <Group>
              {blockers.map((b) => (
                <div
                  key={b.key}
                  className="flex min-h-12 items-center gap-3 px-4 py-2"
                >
                  <CircleAlertIcon
                    strokeWidth={STROKE}
                    className="size-[18px] shrink-0 text-(--a-pending)"
                  />
                  <span className="flex-1 text-[15px]">{b.text}</span>
                  {b.action}
                </div>
              ))}
            </Group>
            <Btn
              size="lg"
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => setFinishOpen(true)}
            >
              Приключи с остатък
            </Btn>
            {derived.unclaimedUnits > 0 && (
              <button
                type="button"
                onClick={onGoItems}
                className="mt-2 w-full text-center text-[13px] text-(--a-accent)"
              >
                Виж свободните бройки
              </button>
            )}
          </div>
        )}
      </section>

      <Confirm
        open={finishOpen}
        onOpenChange={setFinishOpen}
        title="Приключи с остатък?"
        description={
          <>
            Сметката ще се заключи.{' '}
            {derived.outstandingCents > 0 && (
              <>
                Неплатените{' '}
                <Money
                  cents={derived.outstandingCents}
                  className="font-semibold text-(--a-text)"
                />{' '}
                остават като дълг на началния екран.
              </>
            )}{' '}
            {derived.unclaimedUnits > 0 && (
              <>
                Свободните{' '}
                <Money
                  cents={derived.unclaimedCents}
                  className="font-semibold text-(--a-text)"
                />{' '}
                остават за ваша сметка.
              </>
            )}
          </>
        }
        confirmLabel="Приключи"
        onConfirm={() => dispatch({ type: 'finalize' })}
      />
      <SplitRestConfirm open={splitOpen} onOpenChange={setSplitOpen} />
    </div>
  )
}
