/**
 * PROTOTYPE — Direction A guest Claim (Sunday / HungryPay checkout): Claim
 * group rows with − n +, explicit „Сподели“, filter + search, Covered seats,
 * and a sticky bar with the live share and „Към плащане“.
 */
import { useState } from 'react'
import {
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
  ClockIcon,
  LogOutIcon,
  SearchIcon,
  TriangleAlertIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import type { ClaimGroup } from '../../../../../../shared/claim-groups.ts'
import { useLiveTable } from '../../mock/live.ts'
import { formatEur, useProto } from '../../mock/store.tsx'
import {
  ASheet,
  AvatarStack,
  Btn,
  Chip,
  Confirm,
  Group,
  Meter,
  Money,
  Pill,
  RowMenu,
  STROKE,
  Segmented,
  Stepper,
  TextInput,
} from '../ui.tsx'
import { perHeadText, portionFor } from '../split.ts'

type Filter = 'all' | 'free' | 'mine'

export function Claim({
  onPay,
  onStatus,
}: {
  onPay: () => void
  onStatus: () => void
}) {
  const store = useProto()
  const { derived, state, dispatch, mySeatIds } = store
  const { bill } = derived
  useLiveTable(true)

  const me = state.guestSeatId as string
  const [activeSeat, setActiveSeat] = useState(me)
  const seat = mySeatIds.includes(activeSeat) ? activeSeat : me
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [shareKey, setShareKey] = useState<string | null>(null)
  const [coverOpen, setCoverOpen] = useState(false)
  const locked = bill.status === 'final'

  const q = query.trim().toLocaleLowerCase('bg')
  const groups = derived.groups.filter((g) => {
    if (q && !g.name.toLocaleLowerCase('bg').includes(q)) return false
    if (filter === 'free')
      return derived.seatView(g.key, seat).freeUnits.length > 0
    if (filter === 'mine')
      return mySeatIds.some((id) => derived.seatView(g.key, id).myUnitCount > 0)
    return true
  })

  const shareGroup = derived.groups.find((g) => g.key === shareKey) ?? null

  return (
    <div className="pb-44 lg:pb-16">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-(--a-hairline) bg-(--a-bg)">
        <div className="mx-auto flex h-14 max-w-[1040px] items-center gap-3 px-4 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold tracking-[-0.01em]">
              {bill.restaurantName || 'Сметка'}
            </h1>
            <p className="truncate text-[13px] text-(--a-muted)">
              Вие сте{' '}
              <span className="font-medium text-(--a-text)">
                {derived.labels[me]}
              </span>
            </p>
          </div>
          <RowMenu
            label="Още"
            items={[
              {
                label: `Не съм ${derived.labels[me]}`,
                icon: <LogOutIcon strokeWidth={STROKE} />,
                onSelect: () => dispatch({ type: 'leaveSeat' }),
              },
            ]}
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1040px] lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:px-8">
        <main className="mx-auto w-full max-w-xl px-4 pt-4 lg:max-w-none lg:px-0">
          {locked && (
            <div className="mb-4 flex items-center gap-3 rounded-[14px] bg-(--a-surface-2) px-4 py-3 text-[13px] text-(--a-muted)">
              <LockIcon strokeWidth={STROKE} className="size-4 shrink-0" />
              {derived.labels[bill.hostParticipantId]} приключи сметката.
              Отбелязването е заключено.
            </div>
          )}
          {/* Covered seats */}
          <div className="flex flex-wrap items-center gap-2">
            {mySeatIds.length > 1 ? (
              <>
                <span className="text-[13px] text-(--a-muted)">
                  Отбелязвате за
                </span>
                <Segmented
                  value={seat}
                  onChange={setActiveSeat}
                  options={mySeatIds.map((id) => ({
                    value: id,
                    label: derived.labels[id] ?? '?',
                  }))}
                />
              </>
            ) : null}
            {!locked && (
              <Chip
                onClick={() => setCoverOpen(true)}
                className="h-8 text-[13px]"
              >
                <UserPlusIcon strokeWidth={STROKE} />
                {mySeatIds.length > 1 ? 'Промени' : 'Плащам и за някого'}
              </Chip>
            )}
          </div>

          {/* Table progress */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-[13px] text-(--a-muted)">
              <span className="tabular-nums">
                На масата: {derived.claimedUnits} от {derived.totalUnits} бройки
                са взети
              </span>
            </div>
            <Meter value={derived.claimedUnits} max={derived.totalUnits} />
          </div>

          {/* Filter + search */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Segmented
              value={filter}
              onChange={setFilter}
              className="w-full sm:w-auto"
              options={[
                { value: 'all', label: 'Всички' },
                { value: 'free', label: 'Свободни' },
                { value: 'mine', label: 'Мои' },
              ]}
            />
            <div className="relative flex-1">
              <SearchIcon
                strokeWidth={STROKE}
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--a-muted)"
              />
              <TextInput
                aria-label="Търси артикул"
                placeholder="Търси"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 pl-9 text-[15px]"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Изчисти"
                  onClick={() => setQuery('')}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-(--a-muted)"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="mt-4">
            {groups.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-(--a-field) px-6 py-10 text-center text-[15px] text-(--a-muted)">
                {q
                  ? `Нищо не съвпада с „${query.trim()}“.`
                  : filter === 'mine'
                    ? 'Още не сте взели нищо. Натиснете + до това, което сте яли.'
                    : filter === 'free'
                      ? 'Всичко е взето. Проверете дали вашето е при вас.'
                      : 'Домакинът още не е добавил артикули.'}
              </div>
            ) : (
              <Group>
                {groups.map((g) => (
                  <GuestClaimRow
                    key={g.key}
                    group={g}
                    seat={seat}
                    locked={locked}
                    onShare={() => setShareKey(g.key)}
                  />
                ))}
              </Group>
            )}
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-20 mt-4 rounded-[14px] border border-(--a-hairline) bg-(--a-surface) p-5">
            <ShareSummary onPay={onPay} onStatus={onStatus} panel />
          </div>
        </aside>
      </div>

      {/* Sticky bottom bar (phones, tablets) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-(--a-hairline) bg-(--a-surface) shadow-(--a-sheet-shadow) lg:hidden">
        <Meter
          value={derived.claimedUnits}
          max={derived.totalUnits}
          className="-mt-px h-[2px]"
        />
        <div className="mx-auto max-w-xl px-4 pt-3 pb-[max(env(safe-area-inset-bottom),14px)]">
          <ShareSummary onPay={onPay} onStatus={onStatus} />
        </div>
      </div>

      <GuestShareSheet
        group={shareGroup}
        seat={seat}
        onClose={() => setShareKey(null)}
      />
      <CoverSheet open={coverOpen} onOpenChange={setCoverOpen} />
    </div>
  )
}

/* ---------------------------------------------------------------- row */

function GuestClaimRow({
  group,
  seat,
  locked,
  onShare,
}: {
  group: ClaimGroup
  seat: string
  locked: boolean
  onShare: () => void
}) {
  const { derived, dispatch } = useProto()
  const [joinOpen, setJoinOpen] = useState(false)
  const view = derived.seatView(group.key, seat)
  const free = view.freeUnits.length
  const solo = view.mySoloUnits.length
  const others = view.otherClaimantCounts
  const mine = view.myUnitCount > 0
  const showStepper = !locked && (free > 0 || solo > 0)
  const joinOption = view.joinOptions.at(0)
  const canJoin = !locked && !showStepper && !mine && !!joinOption
  const participants = derived.bill.participants
  return (
    <div
      className={cn(
        'px-4 py-3 transition-colors',
        mine && 'bg-[color-mix(in_oklch,var(--a-accent-soft)_45%,transparent)]',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-medium">{group.name}</p>
          <p className="mt-0.5 text-[13px] text-(--a-muted) tabular-nums">
            {formatEur(group.unitPriceCents)}
            {view.totalUnits > 1 && (
              <>
                {', '}
                <span
                  className={
                    free > 0 ? 'font-medium text-(--a-text)' : undefined
                  }
                >
                  {free === 0
                    ? 'няма свободни'
                    : `${free} от ${view.totalUnits} свободни`}
                </span>
              </>
            )}
            {view.totalUnits === 1 && free === 0 && !mine && ', взета'}
          </p>
        </div>
        {showStepper && (
          <Stepper
            value={solo}
            label={group.name}
            onDec={() =>
              dispatch({
                type: 'releaseUnit',
                groupKey: group.key,
                participantId: seat,
              })
            }
            onInc={() =>
              dispatch({
                type: 'takeUnit',
                groupKey: group.key,
                participantId: seat,
              })
            }
            incDisabled={free === 0}
          />
        )}
        {canJoin && (
          <Btn
            size="sm"
            variant="quiet"
            className="text-(--a-muted)"
            onClick={() => setJoinOpen(true)}
          >
            Делихме я
          </Btn>
        )}
      </div>

      {(others.length > 0 || mine || (!locked && free >= 2)) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {others.length > 0 && (
            <span className="flex items-center gap-1.5 text-[13px] text-(--a-muted)">
              <AvatarStack
                names={others.map(
                  (o) => derived.labels[o.participantId] ?? '?',
                )}
                max={3}
                size={20}
              />
              <span className="truncate">
                {others
                  .slice(0, 2)
                  .map(
                    (o) =>
                      `${derived.labels[o.participantId]}${o.units > 1 ? ` ${o.units}` : ''}`,
                  )
                  .join(', ')}
                {others.length > 2 ? ` и още ${others.length - 2}` : ''}
              </span>
            </span>
          )}
          {mine && (
            <span className="text-[13px] font-semibold text-(--a-accent)">
              Ваши <Money cents={view.myShareCents} />
            </span>
          )}
          <span className="ml-auto flex items-center gap-4">
            {!locked && free >= 2 && (
              <button
                type="button"
                onClick={() => {
                  for (let i = 0; i < free; i++)
                    dispatch({
                      type: 'takeUnit',
                      groupKey: group.key,
                      participantId: seat,
                    })
                }}
                className="text-[13px] font-medium text-(--a-muted) underline-offset-2 hover:text-(--a-text) hover:underline"
              >
                Вземи всички {free}
              </button>
            )}
            {!locked && mine && (
              <button
                type="button"
                onClick={onShare}
                className="flex items-center gap-1 text-[13px] font-medium text-(--a-accent)"
              >
                <UsersIcon strokeWidth={STROKE} className="size-3.5" />
                Сподели
              </button>
            )}
          </span>
        </div>
      )}

      {joinOption && (
        <Confirm
          open={joinOpen}
          onOpenChange={setJoinOpen}
          title={`Делихте ${group.name}?`}
          description={
            <>
              {joinOption.memberIds.map((id) => derived.labels[id]).join(', ')}{' '}
              и вие ще платите{' '}
              <span className="font-semibold text-(--a-text)">
                {perHeadText(
                  group.unitPriceCents,
                  [...joinOption.memberIds, seat],
                  participants,
                )}
              </span>
              . Дялът ви се увеличава с{' '}
              <Money
                cents={joinOption.joinedShareCents}
                className="font-semibold text-(--a-text)"
              />
              .
            </>
          }
          confirmLabel="Да, делихме я"
          onConfirm={() =>
            dispatch({
              type: 'joinUnit',
              unit: joinOption.units[0],
              participantId: seat,
            })
          }
        />
      )}

      {view.mySharedUnits.map((su) => (
        <div
          key={`${su.unit.itemId}-${su.unit.unitIndex}`}
          className="mt-2 flex items-center gap-2 rounded-[10px] bg-(--a-surface-2) py-1.5 pr-1.5 pl-3 text-[13px]"
        >
          <span className="min-w-0 flex-1 truncate">
            Споделена с{' '}
            {su.coMemberIds.map((id) => derived.labels[id]).join(', ')},{' '}
            <Money cents={su.myShareCents} className="font-semibold" />
          </span>
          {!locked && (
            <Btn
              size="sm"
              variant="quiet"
              className="h-7 bg-(--a-surface) px-2.5"
              onClick={() =>
                dispatch({
                  type: 'leaveUnit',
                  unit: su.unit,
                  participantId: seat,
                })
              }
            >
              Махни ме
            </Btn>
          )}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- summary */

function ShareSummary({
  onPay,
  onStatus,
  panel,
}: {
  onPay: () => void
  onStatus: () => void
  panel?: boolean
}) {
  const { derived, mySeatIds } = useProto()
  const mine = derived.seats.filter((s) => mySeatIds.includes(s.participantId))
  const owed = mine.reduce((s, x) => s + x.totals.owedCents, 0)
  const remaining = mine.reduce(
    (s, x) => s + Math.max(0, x.totals.owedCents - x.totals.paidCents),
    0,
  )
  const pending = mine.reduce((s, x) => s + x.pendingCents, 0)
  const settled = owed > 0 && remaining === 0
  const waiting = pending > 0 && pending >= remaining
  const others = mine
    .filter((s) => s.participantId !== mySeatIds[0])
    .map((s) => s.name)

  const warn =
    derived.unclaimedUnits > 0 ? (
      <p className="flex items-center gap-1.5 text-[13px] text-(--a-pending)">
        <TriangleAlertIcon strokeWidth={STROKE} className="size-3.5 shrink-0" />
        {derived.unclaimedUnits === 1
          ? '1 бройка на масата е свободна'
          : `${derived.unclaimedUnits} бройки на масата са свободни`}
      </p>
    ) : null

  const action =
    settled || waiting ? (
      <Btn
        size="lg"
        variant="secondary"
        onClick={onStatus}
        className={panel ? 'w-full' : undefined}
      >
        {settled ? (
          <CheckIcon strokeWidth={2} />
        ) : (
          <ClockIcon strokeWidth={STROKE} />
        )}
        {settled ? 'Платено' : 'Чака'}
      </Btn>
    ) : (
      <Btn
        size="lg"
        onClick={onPay}
        disabled={owed === 0}
        className={panel ? 'w-full' : undefined}
      >
        Към плащане
        <ArrowRightIcon strokeWidth={STROKE} />
      </Btn>
    )

  if (panel) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[13px] text-(--a-muted)">
            Вашият дял{others.length ? ` и ${others.join(', ')}` : ''}
          </p>
          <p className="text-[32px] leading-tight font-semibold tracking-[-0.02em]">
            <Money cents={owed} />
          </p>
          <p className="text-[13px] text-(--a-muted)">
            с бакшиш {derived.bill.tipPercent} %
          </p>
        </div>
        {waiting && (
          <Pill tone="pending" dot>
            Чака потвърждение
          </Pill>
        )}
        {warn}
        {action}
        {owed === 0 && (
          <p className="text-[13px] text-(--a-muted)">
            Натиснете + до това, което сте яли.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {warn}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-(--a-muted)">
            Вашият дял{others.length ? ` и ${others.join(', ')}` : ''}
          </p>
          <p className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">
            <Money cents={owed} />
          </p>
        </div>
        {action}
      </div>
    </div>
  )
}

/* --------------------------------------------------------- share sheet */

function GuestShareSheet({
  group,
  seat,
  onClose,
}: {
  group: ClaimGroup | null
  seat: string
  onClose: () => void
}) {
  const { derived, dispatch } = useProto()
  const [ids, setIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<ClaimGroup | null>(group)
  if (group && group !== last) {
    setLast(group)
    setIds([])
    setError(null)
  }
  const g = group ?? last
  if (!g) return null
  const view = derived.seatView(g.key, seat)
  const participants = derived.bill.participants
  const canNew = view.freeUnits.length > 0 || view.mySoloUnits.length > 0
  const preview =
    ids.length > 0
      ? portionFor(g.unitPriceCents, [seat, ...ids], participants, seat)
      : null

  return (
    <ASheet
      open={!!group}
      onOpenChange={(o) => !o && onClose()}
      title="Сподели бройка"
      description={`${g.name}, ${formatEur(g.unitPriceCents)} за бройка`}
      footer={
        canNew ? (
          <Btn
            size="lg"
            className="w-full"
            onClick={() => {
              if (ids.length === 0) return setError('Изберете с кого я делите')
              dispatch({
                type: 'shareUnit',
                groupKey: g.key,
                actorId: seat,
                withParticipantIds: ids,
              })
              onClose()
            }}
          >
            {preview !== null
              ? `Сподели, ще платите ${formatEur(preview)}`
              : 'Сподели'}
          </Btn>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {canNew ? (
          <section>
            <p className="mb-3 text-[15px] text-(--a-muted)">
              С кого я делите? Сумата се разделя веднага и при тях.
            </p>
            <div className="flex flex-wrap gap-2">
              {derived.seats
                .filter((s) => s.participantId !== seat)
                .map((s) => {
                  const on = ids.includes(s.participantId)
                  return (
                    <Chip
                      key={s.participantId}
                      selected={on}
                      onClick={() => {
                        setError(null)
                        setIds(
                          on
                            ? ids.filter((x) => x !== s.participantId)
                            : [...ids, s.participantId],
                        )
                      }}
                    >
                      {s.name}
                    </Chip>
                  )
                })}
            </div>
            {ids.length > 0 && (
              <p className="mt-3 text-[13px] text-(--a-muted)">
                {perHeadText(g.unitPriceCents, [seat, ...ids], participants)} на
                човек
              </p>
            )}
            {error && (
              <p className="mt-3 text-[13px] font-medium text-(--a-danger)">
                {error}
              </p>
            )}
          </section>
        ) : (
          <p className="text-[15px] text-(--a-muted)">
            Няма свободни бройки за споделяне.
          </p>
        )}

        {view.joinOptions.length > 0 && (
          <section>
            <p className="mb-2 text-[13px] font-medium text-(--a-muted)">
              Или влезте в чужда бройка
            </p>
            <Group>
              {view.joinOptions.map((o) => (
                <div
                  key={o.memberIds.join(',')}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <AvatarStack
                    names={o.memberIds.map((id) => derived.labels[id] ?? '?')}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">
                      {o.memberIds.map((id) => derived.labels[id]).join(', ')}
                    </p>
                    <p className="text-[13px] text-(--a-muted)">
                      Ще платите <Money cents={o.joinedShareCents} />
                    </p>
                  </div>
                  <Btn
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      dispatch({
                        type: 'joinUnit',
                        unit: o.units[0],
                        participantId: seat,
                      })
                      onClose()
                    }}
                  >
                    Споделихме я
                  </Btn>
                </div>
              ))}
            </Group>
          </section>
        )}
      </div>
    </ASheet>
  )
}

/* --------------------------------------------------------- cover sheet */

function CoverSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { derived, state, dispatch } = useProto()
  const me = state.guestSeatId
  const [ids, setIds] = useState<string[]>(state.coveredSeatIds)
  return (
    <ASheet
      open={open}
      onOpenChange={(o) => {
        if (o) setIds(state.coveredSeatIds)
        onOpenChange(o)
      }}
      title="Плащате и за някого?"
      description="Отбелязвате и плащате за тях от този телефон."
      footer={
        <Btn
          size="lg"
          className="w-full"
          onClick={() => {
            dispatch({ type: 'setCovered', participantIds: ids })
            onOpenChange(false)
          }}
        >
          Запази
        </Btn>
      }
    >
      <Group>
        {derived.guests
          .filter((g) => g.participantId !== me)
          .map((g) => {
            const takenByOther = g.phoneSeatId !== null && g.phoneSeatId !== me
            const on = ids.includes(g.participantId)
            return (
              <label
                key={g.participantId}
                className={cn(
                  'flex items-center gap-3 px-4 py-3',
                  takenByOther
                    ? 'text-(--a-muted)'
                    : 'cursor-pointer hover:bg-(--a-surface-2)',
                )}
              >
                <input
                  type="checkbox"
                  disabled={takenByOther}
                  checked={on}
                  onChange={() =>
                    setIds(
                      on
                        ? ids.filter((x) => x !== g.participantId)
                        : [...ids, g.participantId],
                    )
                  }
                  className="size-5 accent-(--a-accent)"
                />
                <span className="flex-1 text-[15px] font-medium">{g.name}</span>
                {takenByOther && <Pill tone="neutral">Има си телефон</Pill>}
              </label>
            )
          })}
      </Group>
    </ASheet>
  )
}
