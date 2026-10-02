/**
 * PROTOTYPE - Direction B host live status: one huge number, one state word
 * per person, only the action that matters now. Assignment is person-first:
 * tap a person, then tap their items.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronRightIcon, LockIcon, PlusIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { formatEur, useProto } from '../mock/store.tsx'
import { useLiveTable } from '../mock/live.ts'
import { hostFocus, personState, reminderText } from './focus.ts'
import {
  BSheet,
  Btn,
  Eur,
  FocusLayout,
  Money,
  RoundBtn,
  STROKE,
  StateWord,
  TopBar,
  plural,
  useCopy,
} from './ui.tsx'
import { DetailsDrawer } from './host-details.tsx'
import type { GoHost } from './routes.ts'

function DetailsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mr-3 h-11 cursor-pointer rounded-full px-4 text-[16px] font-medium text-(--b-muted) hover:bg-(--b-fill) hover:text-(--b-text)"
    >
      Детайли
    </button>
  )
}

/** Dimmed receipt beside the focus column on wide screens. */
function ReceiptContext() {
  const { derived } = useProto()
  return (
    <div>
      <p className="mb-4 text-[17px] font-semibold">Бележката</p>
      <ul className="space-y-3">
        {derived.groups.map((g) => {
          const owners = new Set<string>()
          let free = 0
          for (const u of g.units) {
            const m = derived.unitMembers(u)
            if (m.length === 0) free += 1
            m.forEach((id) => owners.add(derived.labels[id] ?? ''))
          }
          return (
            <li key={g.key} className="flex items-baseline gap-3 text-[15px]">
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {g.units.length > 1 && (
                    <span className="b-num text-(--b-muted)">
                      {g.units.length} ×{' '}
                    </span>
                  )}
                  {g.name}
                </span>
                <span className="block truncate text-[13px] text-(--b-muted)">
                  {[...owners].join(', ')}
                  {free > 0 &&
                    (owners.size > 0
                      ? `, ${free} без собственик`
                      : `${free} без собственик`)}
                </span>
              </span>
              <Eur cents={g.unitPriceCents * g.units.length} />
            </li>
          )
        })}
      </ul>
      <div className="mt-6 flex justify-between text-[15px] text-(--b-muted)">
        <span>Бакшиш {derived.bill.tipPercent}%</span>
        <Eur cents={derived.tipCents} />
      </div>
      <div className="mt-2 flex justify-between text-[17px] font-semibold">
        <span>Общо</span>
        <Eur cents={derived.totals.billTotalCents} />
      </div>
    </div>
  )
}

function Panel({ id, children }: { id: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <div className="rounded-[28px] bg-(--b-surface) p-7">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={id}
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -10 }}
          transition={{ duration: 0.24 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function LiveStatus({ go }: { go: GoHost }) {
  useLiveTable(true)
  const { derived, dispatch } = useProto()
  const [copied, copy] = useCopy()
  const [details, setDetails] = useState(false)
  const [confirmSplit, setConfirmSplit] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const focus = hostFocus(derived)
  const final = derived.bill.status === 'final'
  const people = derived.seats.length

  let label: string
  let number: number
  let sub: ReactNode
  if (final) {
    label = 'Събрахте'
    number = derived.collectedCents
    const rest = derived.outstandingCents + derived.unclaimedCents
    sub =
      rest > 0 ? (
        <>
          Остатък <Eur cents={rest} />, записан
        </>
      ) : (
        'Всичко е върнато.'
      )
  } else if (derived.unclaimedUnits > 0) {
    label = 'Неразпределени'
    number = derived.unclaimedCents
    sub = (
      <>
        До момента ви дължат <Eur cents={derived.outstandingCents} />
      </>
    )
  } else {
    label = 'Остават да ви върнат'
    number = derived.outstandingCents
    sub = (
      <>
        от <Eur cents={derived.totals.billTotalCents} /> за цялата маса
      </>
    )
  }

  let action: ReactNode
  let actionId: string = focus.kind
  switch (focus.kind) {
    case 'confirm':
      actionId = `c-${focus.seat.participantId}`
      action = (
        <>
          <p className="b-question text-[28px]">
            {focus.seat.name} преведе <Money cents={focus.seat.pendingCents} />.
            Пристигнаха ли?
          </p>
          <div className="mt-7 flex flex-col gap-1">
            <Btn
              onClick={() =>
                dispatch({
                  type: 'confirmPayment',
                  participantId: focus.seat.participantId,
                })
              }
            >
              Да, потвърди
            </Btn>
            <Btn
              variant="quiet"
              onClick={() =>
                dispatch({
                  type: 'cancelReport',
                  participantIds: [focus.seat.participantId],
                })
              }
            >
              Още не са дошли
            </Btn>
          </div>
          {focus.more > 0 && (
            <p className="mt-2 text-center text-[15px] text-(--b-muted)">
              След това още {focus.more}{' '}
              {plural(focus.more, 'превод', 'превода')}.
            </p>
          )}
        </>
      )
      break
    case 'unclaimed':
      action = (
        <>
          <p className="b-question text-[28px]">
            {focus.units} {plural(focus.units, 'бройка', 'бройки')} без
            собственик
          </p>
          <p className="mt-3 text-[17px] text-(--b-muted)">
            Хората още избират. Или докоснете човек отдолу и му добавете
            неговото.
          </p>
          <div className="mt-7">
            <Btn variant="secondary" onClick={() => setConfirmSplit(true)}>
              Раздели остатъка поравно
            </Btn>
          </div>
        </>
      )
      break
    case 'invite':
    case 'remind':
      actionId = `${focus.kind}-${focus.seat.participantId}`
      action = (
        <>
          <p className="b-question text-[28px]">
            {focus.kind === 'invite' ? (
              <>Линкът още чака {focus.seat.name}.</>
            ) : (
              <>
                {focus.seat.name} има да ви връща{' '}
                <Money cents={focus.seat.remainingCents} />.
              </>
            )}
          </p>
          <div className="mt-7">
            <Btn
              onClick={() => copy(actionId, reminderText(derived, focus.seat))}
            >
              {copied === actionId
                ? 'Копирано, пратете го'
                : `Напомни на ${focus.seat.name}`}
            </Btn>
          </div>
        </>
      )
      break
    case 'close':
      action = (
        <>
          <p className="b-question text-[28px]">Всички платиха. Готово е.</p>
          <div className="mt-7">
            <Btn onClick={() => dispatch({ type: 'finalize' })}>
              Приключи сметката
            </Btn>
          </div>
        </>
      )
      break
    case 'final':
      action = (
        <>
          <p className="b-question flex items-start gap-3 text-[28px]">
            <LockIcon
              className="mt-1.5 size-6 shrink-0 text-(--b-accent)"
              strokeWidth={STROKE}
            />
            Сметката е приключена.
          </p>
          <p className="mt-3 text-[17px] text-(--b-muted)">
            Никой вече не може да я променя.
          </p>
          <div className="mt-5">
            <Btn
              variant="quiet"
              className="-ml-3"
              onClick={() => dispatch({ type: 'reopen' })}
            >
              Отключи отново
            </Btn>
          </div>
        </>
      )
      break
    case 'empty':
      action = (
        <>
          <p className="b-question text-[28px]">Още няма редове.</p>
          <div className="mt-7">
            <Btn onClick={() => go({ name: 'new', step: 'review' })}>
              Добави редове
            </Btn>
          </div>
        </>
      )
      break
  }

  const canCloseWithRest =
    !final && focus.kind !== 'close' && focus.kind !== 'empty'

  return (
    <FocusLayout context={<ReceiptContext />}>
      <TopBar
        onBack={() => go({ name: 'home' }, -1)}
        backLabel="Сметки"
        title={derived.bill.restaurantName || 'Нова сметка'}
        right={<DetailsButton onClick={() => setDetails(true)} />}
      />

      <section className="mt-10" aria-live="polite">
        <p className="text-[17px] text-(--b-muted)">{label}</p>
        <Money
          cents={number}
          className="b-display mt-2 block text-[76px] sm:text-[92px]"
        />
        <p className="mt-3 text-[16px] text-(--b-muted)">{sub}</p>
      </section>

      <div className="mt-10">
        <Panel id={actionId}>{action}</Panel>
      </div>

      <ul className="-mx-3 mt-12">
        {derived.seats.map((s) => {
          const st = personState(derived, s)
          return (
            <li key={s.participantId}>
              <button
                type="button"
                onClick={() => go({ name: 'person', id: s.participantId })}
                className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-[20px] px-3 py-3 text-left hover:bg-(--b-fill)"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[19px] font-medium">
                    {s.isHost ? `${s.name}, вие` : s.name}
                  </span>
                  <span className="mt-1 block">
                    <StateWord tone={st.tone}>
                      {s.isHost ? 'Платихте на заведението' : st.word}
                    </StateWord>
                  </span>
                </span>
                <Eur
                  cents={
                    s.isHost || st.tone === 'paid'
                      ? s.totals.owedCents
                      : s.remainingCents
                  }
                  className={cn(
                    'text-[19px]',
                    (s.isHost || st.tone === 'paid' || st.tone === 'idle') &&
                      'text-(--b-muted)',
                  )}
                />
                <ChevronRightIcon
                  className="size-5 text-(--b-muted)"
                  strokeWidth={STROKE}
                />
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[15px] text-(--b-muted)">
        {people} {plural(people, 'човек', 'души')} на масата. Докоснете някого,
        за да видите неговото.
      </p>

      {canCloseWithRest && (
        <Btn
          variant="quiet"
          className="mt-8 -ml-3"
          onClick={() => setConfirmClose(true)}
        >
          Приключи с остатък
        </Btn>
      )}

      <DetailsDrawer open={details} onOpenChange={setDetails} />

      <BSheet
        open={confirmSplit}
        onOpenChange={setConfirmSplit}
        title="Раздели остатъка"
      >
        <p className="text-[19px] leading-snug">
          <Eur cents={derived.unclaimedCents} /> без собственик ще се разделят
          поравно между {people} души, по около{' '}
          <Eur
            cents={Math.ceil(derived.unclaimedCents / Math.max(1, people))}
          />{' '}
          на човек.
        </p>
        <p className="mt-3 text-[16px] text-(--b-muted)">
          Всеки ще види новия си дял веднага.
        </p>
        <div className="mt-8 flex flex-col gap-1">
          <Btn
            onClick={() => {
              dispatch({ type: 'splitRestEvenly' })
              setConfirmSplit(false)
            }}
          >
            Раздели поравно
          </Btn>
          <Btn variant="quiet" onClick={() => setConfirmSplit(false)}>
            Не сега
          </Btn>
        </div>
      </BSheet>

      <BSheet
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Приключи с остатък"
      >
        <p className="text-[19px] leading-snug">
          Още не сте получили{' '}
          <Eur cents={derived.outstandingCents + derived.unclaimedCents} />.
        </p>
        <ul className="mt-4 space-y-2">
          {derived.guests
            .filter((g) => g.remainingCents > 0)
            .map((g) => (
              <li
                key={g.participantId}
                className="flex justify-between text-[17px]"
              >
                <span>{g.name}</span>
                <Eur cents={g.remainingCents} />
              </li>
            ))}
          {derived.unclaimedCents > 0 && (
            <li className="flex justify-between text-[17px] text-(--b-muted)">
              <span>Без собственик</span>
              <Eur cents={derived.unclaimedCents} />
            </li>
          )}
        </ul>
        <p className="mt-4 text-[16px] text-(--b-muted)">
          Сметката ще се заключи. Остатъкът остава записан и пак можете да
          напомните.
        </p>
        <div className="mt-8 flex flex-col gap-1">
          <Btn
            onClick={() => {
              dispatch({ type: 'finalize' })
              setConfirmClose(false)
            }}
          >
            Приключи с остатък
          </Btn>
          <Btn variant="quiet" onClick={() => setConfirmClose(false)}>
            Не още
          </Btn>
        </div>
      </BSheet>
    </FocusLayout>
  )
}

/* ----------------------------------------------------------- person */

export function PersonScreen({ id, go }: { id: string; go: GoHost }) {
  const { derived, dispatch } = useProto()
  const [picking, setPicking] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const seat = derived.seats.find((s) => s.participantId === id)
  if (!seat) {
    return (
      <FocusLayout>
        <TopBar onBack={() => go({ name: 'live' }, -1)} backLabel="Сметката" />
        <p className="b-question mt-10 text-[28px]">
          Този човек вече не е на сметката.
        </p>
      </FocusLayout>
    )
  }
  const final = derived.bill.status === 'final'
  const st = personState(derived, seat)
  const rows = derived.groups
    .map((g) => ({ g, v: derived.seatView(g.key, id) }))
    .filter(({ v }) => v.myUnitCount > 0)
  const tip = derived.shareView(id).lines.find((l) => l.kind === 'tip')
  const free = derived.groups.filter(
    (g) => derived.seatView(g.key, id).freeUnits.length > 0,
  )
  const name = seat.isHost ? 'вас' : seat.name

  return (
    <FocusLayout
      context={<ReceiptContext />}
      bottom={
        !final ? (
          <Btn
            variant={seat.pendingCents > 0 ? 'secondary' : 'primary'}
            onClick={() => setPicking(true)}
            disabled={free.length === 0}
          >
            {free.length === 0 ? (
              'Всичко е разпределено'
            ) : (
              <>
                <PlusIcon className="size-5" strokeWidth={STROKE} />
                {seat.isHost
                  ? 'Добави артикул към вас'
                  : `Добави артикул към ${seat.name}`}
              </>
            )}
          </Btn>
        ) : undefined
      }
    >
      <TopBar onBack={() => go({ name: 'live' }, -1)} backLabel="Сметката" />
      <h1 className="b-question mt-8 text-[34px]">
        {seat.isHost ? 'Вашият дял' : seat.name}
      </h1>
      <div className="mt-2">
        <StateWord tone={st.tone}>
          {seat.isHost ? 'Вие платихте на заведението' : st.word}
        </StateWord>
      </div>
      <Money
        cents={seat.totals.owedCents}
        className="b-display mt-8 block text-[76px] sm:text-[88px]"
      />
      {!seat.isHost && seat.totals.paidCents > 0 && seat.remainingCents > 0 && (
        <p className="mt-2 text-[16px] text-(--b-muted)">
          Платено <Eur cents={seat.totals.paidCents} />, остават{' '}
          <Eur cents={seat.remainingCents} />
        </p>
      )}

      {seat.pendingCents > 0 && (
        <div className="mt-8 rounded-[28px] bg-(--b-surface) p-7">
          <p className="b-question text-[26px]">
            {seat.name} преведе <Money cents={seat.pendingCents} />. Пристигнаха
            ли?
          </p>
          <div className="mt-6">
            <Btn
              onClick={() =>
                dispatch({ type: 'confirmPayment', participantId: id })
              }
            >
              Да, потвърди
            </Btn>
          </div>
        </div>
      )}

      <div className="mt-10">
        {rows.length === 0 ? (
          <p className="rounded-[28px] bg-(--b-surface) p-7 text-[17px] text-(--b-muted)">
            Още нищо не е отбелязано за {name}.
            {!final && ' Добавете артикулите отдолу.'}
          </p>
        ) : (
          <ul className="-mx-3">
            {rows.map(({ g, v }) => {
              const shared = v.mySharedUnits.length > 0
              const with_ = [
                ...new Set(v.mySharedUnits.flatMap((s) => s.coMemberIds)),
              ]
                .map((m) => derived.labels[m])
                .join(', ')
              return (
                <li key={g.key} className="flex items-center gap-3 px-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[18px]">{g.name}</span>
                    <span className="block text-[15px] text-(--b-muted)">
                      {v.mySoloUnits.length > 0 &&
                        `${v.mySoloUnits.length} бр.`}
                      {v.mySoloUnits.length > 0 && shared && ', '}
                      {shared && `споделено с ${with_}`}
                    </span>
                  </span>
                  <Eur cents={v.myShareCents} className="text-[18px]" />
                  {!final && v.mySoloUnits.length > 0 && (
                    <RoundBtn
                      kind="minus"
                      size="md"
                      label={`Махни една бройка ${g.name}`}
                      onClick={() =>
                        dispatch({
                          type: 'releaseUnit',
                          groupKey: g.key,
                          participantId: id,
                        })
                      }
                    />
                  )}
                </li>
              )
            })}
            {tip && (
              <li className="flex items-center gap-3 px-3 py-3 text-(--b-muted)">
                <span className="flex-1 text-[17px]">Бакшиш</span>
                <Eur cents={tip.amountCents} className="text-[17px]" />
                {!final && <span className="size-11" />}
              </li>
            )}
          </ul>
        )}
      </div>

      {!seat.isHost && (
        <div className="mt-8 flex flex-wrap gap-x-2">
          {seat.remainingCents > 0 && seat.pendingCents === 0 && (
            <Btn
              variant="quiet"
              className="-ml-3"
              onClick={() => dispatch({ type: 'markPaid', participantId: id })}
            >
              Получих в брой
            </Btn>
          )}
          {seat.totals.paidCents > 0 && !final && (
            <Btn
              variant="quiet"
              className="-ml-3"
              onClick={() =>
                dispatch({ type: 'undoPayment', participantId: id })
              }
            >
              Отмени плащането
            </Btn>
          )}
          {!final && seat.claimedUnits === 0 && seat.totals.paidCents === 0 && (
            <Btn
              variant="quiet"
              className="-ml-3"
              onClick={() => setConfirmRemove(true)}
            >
              Махни {seat.name} от сметката
            </Btn>
          )}
        </div>
      )}

      <ItemPicker open={picking} onOpenChange={setPicking} participantId={id} />

      <BSheet
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Махни ${seat.name}?`}
      >
        <p className="text-[18px]">
          {seat.name} няма да е на сметката и линкът няма да показва това име.
        </p>
        <div className="mt-8 flex flex-col gap-1">
          <Btn
            onClick={() => {
              dispatch({ type: 'removeParticipant', participantId: id })
              go({ name: 'live' }, -1)
            }}
          >
            Махни
          </Btn>
          <Btn variant="quiet" onClick={() => setConfirmRemove(false)}>
            Остави
          </Btn>
        </div>
      </BSheet>
    </FocusLayout>
  )
}

function ItemPicker({
  open,
  onOpenChange,
  participantId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  participantId: string
}) {
  const { derived, dispatch } = useProto()
  const seat = derived.seats.find((s) => s.participantId === participantId)
  const who = seat?.isHost ? 'вас' : (seat?.name ?? '')
  const rows = derived.groups.map((g) => ({
    g,
    v: derived.seatView(g.key, participantId),
  }))
  const anyFree = rows.some(({ v }) => v.freeUnits.length > 0)
  return (
    <BSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Какво беше за ${who}?`}
      tall
    >
      <p className="-mt-1 mb-4 text-[16px] text-(--b-muted)">
        Докоснете +, за да добавите една бройка.
      </p>
      {!anyFree && (
        <p className="py-8 text-center text-[17px] text-(--b-muted)">
          Всичко вече е разпределено.
        </p>
      )}
      <ul className="-mx-2">
        {rows
          .filter(({ v }) => v.freeUnits.length > 0 || v.mySoloUnits.length > 0)
          .map(({ g, v }) => (
            <li key={g.key} className="flex items-center gap-3 px-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[18px]">{g.name}</span>
                <span className="b-num block text-[15px] text-(--b-muted)">
                  {formatEur(g.unitPriceCents)}
                  {', '}
                  {v.freeUnits.length > 0
                    ? `${v.freeUnits.length} ${plural(v.freeUnits.length, 'свободна', 'свободни')}`
                    : 'няма свободни'}
                </span>
              </span>
              {v.mySoloUnits.length > 0 && (
                <span className="b-num grid size-9 place-items-center rounded-full bg-(--b-accent-soft) text-[15px] font-semibold text-(--b-accent)">
                  {v.mySoloUnits.length}
                </span>
              )}
              <RoundBtn
                kind="plus"
                label={`Добави ${g.name}`}
                disabled={v.freeUnits.length === 0}
                onClick={() =>
                  dispatch({ type: 'takeUnit', groupKey: g.key, participantId })
                }
              />
            </li>
          ))}
      </ul>
      <div className="sticky bottom-0 mt-4 bg-(--b-surface) pt-3">
        <Btn variant="secondary" onClick={() => onOpenChange(false)}>
          Готово
        </Btn>
      </div>
    </BSheet>
  )
}
