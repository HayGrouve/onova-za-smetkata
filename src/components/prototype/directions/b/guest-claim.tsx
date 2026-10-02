/**
 * PROTOTYPE - Direction B guest claim: one running number, a focused list
 * where each row is just name, price and a big round +. Taking a Unit reveals
 * − and „Сподели“. Covering someone else stays a quiet link until used.
 */
import { useState } from 'react'
import { CheckIcon, LockIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { formatEur, useProto } from '../mock/store.tsx'
import { useLiveTable } from '../mock/live.ts'
import type { ClaimGroup } from '../../../../../shared/claim-groups.ts'
import {
  BSheet,
  Btn,
  Eur,
  FocusLayout,
  Money,
  Reveal,
  RoundBtn,
  STROKE,
  TopBar,
  plural,
} from './ui.tsx'
import type { GuestRoute } from './routes.ts'

/** Dimmed table beside the column on wide screens. */
function TableContext() {
  const { derived } = useProto()
  return (
    <div>
      <p className="mb-4 text-[17px] font-semibold">Масата</p>
      <ul className="space-y-3">
        {derived.seats.map((s) => (
          <li
            key={s.participantId}
            className="flex items-baseline justify-between gap-3 text-[16px]"
          >
            <span>{s.name}</span>
            <Eur cents={s.totals.owedCents} className="text-(--b-muted)" />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[15px] text-(--b-muted)">
        Избрани {derived.claimedUnits} от {derived.totalUnits} бройки.
      </p>
    </div>
  )
}

export function GuestClaim({
  go,
}: {
  go: (r: GuestRoute, dir?: number) => void
}) {
  useLiveTable(true)
  const { derived, state, dispatch, mySeatIds } = useProto()
  const me = state.guestSeatId ?? ''
  const [active, setActive] = useState(me)
  const [sharing, setSharing] = useState<ClaimGroup | null>(null)
  const [joining, setJoining] = useState<ClaimGroup | null>(null)
  const [covering, setCovering] = useState(false)
  const seatId = mySeatIds.includes(active) ? active : me
  const final = derived.bill.status === 'final'
  const meSeat = derived.seats.find((s) => s.participantId === me)
  const covered = state.coveredSeatIds
    .map((id) => derived.seats.find((s) => s.participantId === id))
    .filter((s) => s !== undefined)
  const myCents = mySeatIds.reduce(
    (sum, id) =>
      sum +
      (derived.seats.find((s) => s.participantId === id)?.remainingCents ?? 0),
    0,
  )
  const myOwed = mySeatIds.reduce(
    (sum, id) =>
      sum +
      (derived.seats.find((s) => s.participantId === id)?.totals.owedCents ??
        0),
    0,
  )
  const myUnits = mySeatIds.reduce(
    (sum, id) =>
      sum +
      (derived.seats.find((s) => s.participantId === id)?.claimedUnits ?? 0),
    0,
  )
  const showWarning = derived.unclaimedUnits > 0 && myUnits > 0 && !final

  return (
    <FocusLayout
      context={<TableContext />}
      bottom={
        <div>
          <Reveal show={showWarning}>
            <p className="mb-3 text-center text-[15px] whitespace-nowrap text-(--b-warn)">
              Още {derived.unclaimedUnits}{' '}
              {plural(derived.unclaimedUnits, 'бройка', 'бройки')} без
              собственик
            </p>
          </Reveal>
          <Btn
            disabled={myCents === 0 || myUnits === 0}
            onClick={() => go('pay')}
            className="justify-between"
          >
            {myCents === 0 || myUnits === 0 ? (
              <span className="w-full text-center">
                {myUnits > 0 && myOwed > 0
                  ? 'Всичко е платено'
                  : 'Докоснете + до своето'}
              </span>
            ) : (
              <>
                <span>Готово, към плащане</span>
                <Eur cents={myCents} className="font-medium opacity-80" />
              </>
            )}
          </Btn>
        </div>
      }
    >
      <TopBar
        title={derived.bill.restaurantName}
        right={
          !final ? (
            <button
              type="button"
              onClick={() => dispatch({ type: 'leaveSeat' })}
              className="-mr-3 h-11 cursor-pointer rounded-full px-3 text-[15px] font-medium text-(--b-muted) hover:text-(--b-text)"
            >
              Не сте {meSeat?.name}?
            </button>
          ) : undefined
        }
      />

      <section className="mt-8" aria-live="polite">
        <p className="text-[17px] text-(--b-muted)">
          {covered.length > 0
            ? `Вашият дял и на ${covered.map((c) => c.name).join(', ')}`
            : 'Вашият дял'}
        </p>
        <Money
          cents={myOwed}
          className="b-display mt-2 block text-[84px] sm:text-[96px]"
        />
      </section>

      {final && (
        <p className="mt-6 flex items-center gap-2 text-[17px] text-(--b-muted)">
          <LockIcon className="size-4" strokeWidth={STROKE} />
          Сметката е приключена. Изборът е заключен.
        </p>
      )}

      {!final && (
        <div className="mt-4">
          {covered.length === 0 ? (
            <Btn
              variant="quiet"
              className="-ml-3"
              onClick={() => setCovering(true)}
            >
              Плащам и за…
            </Btn>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[15px] text-(--b-muted)">
                Избирате за
              </span>
              {[meSeat, ...covered].map(
                (s) =>
                  s && (
                    <button
                      key={s.participantId}
                      type="button"
                      aria-pressed={seatId === s.participantId}
                      onClick={() => setActive(s.participantId)}
                      className={cn(
                        'h-10 cursor-pointer rounded-full px-4 text-[16px] font-semibold transition-colors',
                        seatId === s.participantId
                          ? 'bg-(--b-text) text-(--b-bg)'
                          : 'bg-(--b-fill) text-(--b-text)',
                      )}
                    >
                      {s.participantId === me ? 'Вас' : s.name}
                    </button>
                  ),
              )}
              <Btn variant="quiet" onClick={() => setCovering(true)}>
                Промени
              </Btn>
            </div>
          )}
        </div>
      )}

      <ul className="-mx-3 mt-8">
        {derived.groups.map((g) => {
          const v = derived.seatView(g.key, seatId)
          const mine = v.myUnitCount
          const free = v.freeUnits.length
          const others = v.otherClaimantCounts
            .map((o) => derived.labels[o.participantId])
            .filter(Boolean)
          const sharedWith = [
            ...new Set(v.mySharedUnits.flatMap((s) => s.coMemberIds)),
          ].map((id) => derived.labels[id])
          let sub: string
          if (mine === 0 && free === 0) sub = `Взето от ${others.join(', ')}`
          else if (g.units.length > 1 && free > 0)
            sub = `${formatEur(g.unitPriceCents)}, ${free} ${plural(free, 'свободна', 'свободни')}`
          else sub = formatEur(g.unitPriceCents)
          return (
            <li
              key={g.key}
              className={cn(
                'rounded-[24px] px-3 py-3 transition-colors',
                mine > 0 && 'bg-(--b-surface)',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-[19px] leading-tight',
                      mine === 0 && free === 0 && 'text-(--b-muted)',
                    )}
                  >
                    {g.name}
                  </span>
                  <span className="b-num mt-0.5 block text-[15px] text-(--b-muted)">
                    {sub}
                  </span>
                  {!final && free > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        for (let i = 0; i < free; i++) {
                          dispatch({
                            type: 'takeUnit',
                            groupKey: g.key,
                            participantId: seatId,
                          })
                        }
                      }}
                      className="-ml-1 mt-1 h-8 cursor-pointer rounded-full px-1 text-[15px] font-semibold text-(--b-accent) hover:underline"
                    >
                      Вземи останалите {free}
                    </button>
                  )}
                </span>
                {!final && mine > 0 && v.mySoloUnits.length > 0 && (
                  <RoundBtn
                    kind="minus"
                    size="md"
                    label={`Върни една бройка ${g.name}`}
                    onClick={() =>
                      dispatch({
                        type: 'releaseUnit',
                        groupKey: g.key,
                        participantId: seatId,
                      })
                    }
                  />
                )}
                {mine > 0 && (
                  <span
                    className="b-num w-7 text-center text-[20px] font-semibold"
                    aria-label={`${mine} ваши`}
                  >
                    {mine}
                  </span>
                )}
                {!final && free > 0 && (
                  <RoundBtn
                    kind="plus"
                    soft={mine === 0}
                    label={`Взимам ${g.name}`}
                    onClick={() =>
                      dispatch({
                        type: 'takeUnit',
                        groupKey: g.key,
                        participantId: seatId,
                      })
                    }
                  />
                )}
                {!final &&
                  mine === 0 &&
                  free === 0 &&
                  v.joinOptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setJoining(g)}
                      className="h-10 cursor-pointer rounded-full px-4 text-[15px] font-medium text-(--b-muted) shadow-[inset_0_0_0_1.5px_var(--b-line)] hover:text-(--b-text)"
                    >
                      Делихме я
                    </button>
                  )}
              </div>
              <Reveal show={mine > 0}>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Eur
                    cents={v.myShareCents}
                    className="text-[16px] font-semibold"
                  />
                  {sharedWith.length > 0 && (
                    <span className="text-[15px] text-(--b-muted)">
                      споделено с {sharedWith.join(', ')}
                    </span>
                  )}
                  {!final && v.mySoloUnits.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSharing(g)}
                      className="ml-auto h-9 cursor-pointer rounded-full px-4 text-[15px] font-semibold text-(--b-text) shadow-[inset_0_0_0_1.5px_var(--b-line)] hover:bg-(--b-fill)"
                    >
                      Сподели
                    </button>
                  )}
                </div>
              </Reveal>
            </li>
          )
        })}
      </ul>

      <ShareSheet
        group={sharing}
        seatId={seatId}
        onClose={() => setSharing(null)}
      />
      <JoinSheet
        group={joining}
        seatId={seatId}
        onClose={() => setJoining(null)}
      />
      <CoverSheet open={covering} onOpenChange={setCovering} />
    </FocusLayout>
  )
}

function ShareSheet({
  group,
  seatId,
  onClose,
}: {
  group: ClaimGroup | null
  seatId: string
  onClose: () => void
}) {
  const { derived, dispatch } = useProto()
  const [picked, setPicked] = useState<string[]>([])
  const close = () => {
    setPicked([])
    onClose()
  }
  const v = group ? derived.seatView(group.key, seatId) : null
  const each = group ? Math.ceil(group.unitPriceCents / (picked.length + 1)) : 0
  return (
    <BSheet
      open={group !== null}
      onOpenChange={(o) => !o && close()}
      title="С кого я споделихте?"
    >
      {group && v && (
        <>
          <p className="-mt-1 text-[17px] text-(--b-muted)">
            Една бройка {group.name}, {formatEur(group.unitPriceCents)}.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {derived.seats
              .filter((s) => s.participantId !== seatId)
              .map((s) => {
                const on = picked.includes(s.participantId)
                return (
                  <button
                    key={s.participantId}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setPicked(
                        on
                          ? picked.filter((x) => x !== s.participantId)
                          : [...picked, s.participantId],
                      )
                    }
                    className={cn(
                      'flex h-16 cursor-pointer items-center justify-between rounded-[20px] px-4 text-[18px] font-semibold transition-colors',
                      on ? 'bg-(--b-accent-soft)' : 'bg-(--b-fill)',
                    )}
                  >
                    {s.name}
                    {on && (
                      <CheckIcon
                        className="size-5 text-(--b-accent)"
                        strokeWidth={2.25}
                      />
                    )}
                  </button>
                )
              })}
          </div>
          <Reveal show={picked.length > 0}>
            <p className="mt-6 text-[17px]">
              Вашата част ще е около{' '}
              <Eur cents={each} className="font-semibold" />. За другите се
              смята веднага.
            </p>
          </Reveal>
          <Btn
            className="mt-6"
            disabled={picked.length === 0}
            onClick={() => {
              dispatch({
                type: 'shareUnit',
                groupKey: group.key,
                actorId: seatId,
                withParticipantIds: picked,
                unit: v.mySoloUnits[0],
              })
              close()
            }}
          >
            Сподели
          </Btn>
        </>
      )}
    </BSheet>
  )
}

function JoinSheet({
  group,
  seatId,
  onClose,
}: {
  group: ClaimGroup | null
  seatId: string
  onClose: () => void
}) {
  const { derived, dispatch } = useProto()
  const v = group ? derived.seatView(group.key, seatId) : null
  const opt = v?.joinOptions[0]
  const names = opt?.memberIds.map((id) => derived.labels[id]).join(', ')
  return (
    <BSheet
      open={group !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Делихте я?"
    >
      {group && opt && (
        <>
          <p className="text-[19px] leading-snug">
            Ще поемете{' '}
            <Eur cents={opt.joinedShareCents} className="font-semibold" /> от{' '}
            {group.name}. {names} ще плаща по-малко.
          </p>
          <div className="mt-8 flex flex-col gap-1">
            <Btn
              onClick={() => {
                dispatch({
                  type: 'joinUnit',
                  unit: opt.units[0],
                  participantId: seatId,
                })
                onClose()
              }}
            >
              Да, делихме я
            </Btn>
            <Btn variant="quiet" onClick={onClose}>
              Не
            </Btn>
          </div>
        </>
      )}
    </BSheet>
  )
}

function CoverSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { derived, state, dispatch } = useProto()
  const me = state.guestSeatId
  const options = derived.guests.filter(
    (g) =>
      g.participantId !== me &&
      (!(g.participantId in state.bill.seatPhones) ||
        state.bill.seatPhones[g.participantId] === me),
  )
  const taken = derived.guests.filter(
    (g) =>
      g.participantId !== me &&
      g.participantId in state.bill.seatPhones &&
      state.bill.seatPhones[g.participantId] !== me,
  )
  const covered = state.coveredSeatIds
  return (
    <BSheet
      open={open}
      onOpenChange={onOpenChange}
      title="За кого още плащате?"
    >
      <p className="-mt-1 text-[17px] text-(--b-muted)">
        Избирате и плащате вместо тях от този телефон.
      </p>
      {options.length === 0 && (
        <p className="mt-6 text-[17px]">
          Всички други вече са с телефоните си.
        </p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-2">
        {options.map((s) => {
          const on = covered.includes(s.participantId)
          return (
            <button
              key={s.participantId}
              type="button"
              aria-pressed={on}
              onClick={() =>
                dispatch({
                  type: 'setCovered',
                  participantIds: on
                    ? covered.filter((x) => x !== s.participantId)
                    : [...covered, s.participantId],
                })
              }
              className={cn(
                'flex h-16 cursor-pointer items-center justify-between rounded-[20px] px-4 text-[18px] font-semibold transition-colors',
                on ? 'bg-(--b-accent-soft)' : 'bg-(--b-fill)',
              )}
            >
              {s.name}
              {on && (
                <CheckIcon
                  className="size-5 text-(--b-accent)"
                  strokeWidth={2.25}
                />
              )}
            </button>
          )
        })}
        {taken.map((s) => (
          <div
            key={s.participantId}
            className="flex h-16 flex-col justify-center rounded-[20px] px-4 shadow-[inset_0_0_0_1.5px_var(--b-line)]"
          >
            <span className="text-[18px] font-semibold text-(--b-muted)">
              {s.name}
            </span>
            <span className="text-[14px] text-(--b-muted)">Заето</span>
          </div>
        ))}
      </div>
      <Btn
        className="mt-6"
        variant="secondary"
        onClick={() => onOpenChange(false)}
      >
        Готово
      </Btn>
    </BSheet>
  )
}
