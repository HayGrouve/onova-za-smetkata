/**
 * PROTOTYPE - Direction B guest pay: one enormous amount, „За кого“ folded
 * under it, one button. Then a done screen that flips when the host confirms.
 */
import { useState } from 'react'
import { CheckIcon, ChevronDownIcon, ClockIcon, CopyIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { useProto } from '../mock/store.tsx'
import { HOST_PAYOUT } from '../mock/data.ts'
import {
  BSheet,
  Btn,
  Eur,
  FocusLayout,
  Money,
  Reveal,
  STROKE,
  TopBar,
  useCopy,
} from './ui.tsx'
import type { GuestRoute } from './routes.ts'

function Breakdown({ ids }: { ids: string[] }) {
  const { derived } = useProto()
  return (
    <div className="space-y-8">
      {ids.map((id) => {
        const v = derived.shareView(id)
        return (
          <div key={id}>
            <p className="text-[17px] font-semibold">{derived.labels[id]}</p>
            <ul className="mt-2 space-y-2">
              {v.lines.map((l) => (
                <li
                  key={l.key}
                  className="flex items-baseline gap-3 text-[16px]"
                >
                  <span className="min-w-0 flex-1">
                    {l.kind === 'tip' ? 'Бакшиш' : l.label}
                    {(l.unitsText || l.sharedText) && (
                      <span className="block text-[14px] text-(--b-muted)">
                        {[l.unitsText, l.sharedText].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </span>
                  <Eur cents={l.amountCents} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export function GuestPay({
  go,
  onPaid,
}: {
  go: (r: GuestRoute, dir?: number) => void
  onPaid: (ids: string[]) => void
}) {
  const { derived, state, dispatch, mySeatIds } = useProto()
  const payable = derived.guests.filter(
    (g) => g.remainingCents > 0 && g.pendingCents === 0,
  )
  const [selected, setSelected] = useState<string[]>(() =>
    mySeatIds.filter((id) => payable.some((p) => p.participantId === id)),
  )
  const [forOpen, setForOpen] = useState(false)
  const [revolut, setRevolut] = useState(false)
  const [iban, setIban] = useState(false)
  const [details, setDetails] = useState(false)
  const [copied, copy] = useCopy()
  const host = derived.seats.find((s) => s.isHost)
  const live = selected.filter((id) =>
    payable.some((p) => p.participantId === id),
  )
  const amount = live.reduce(
    (s, id) =>
      s + (payable.find((p) => p.participantId === id)?.remainingCents ?? 0),
    0,
  )
  const forLabel = live
    .map((id) => (id === state.guestSeatId ? 'вас' : derived.labels[id]))
    .join(' и ')
  const others = payable.filter((p) => !mySeatIds.includes(p.participantId))
  const reference = `${derived.bill.restaurantName}, ${live.map((id) => derived.labels[id]).join(', ')}`

  const paid = () => {
    dispatch({ type: 'reportPaid', participantIds: live })
    setRevolut(false)
    setIban(false)
    onPaid(live)
  }

  return (
    <FocusLayout
      context={
        <div>
          <p className="mb-4 text-[17px] font-semibold">Какво плащате</p>
          <Breakdown ids={live} />
        </div>
      }
      bottom={
        amount > 0 ? (
          <div className="flex flex-col gap-1">
            <Btn onClick={() => setRevolut(true)}>Плати с Revolut</Btn>
            <Btn variant="quiet" onClick={() => setIban(true)}>
              Или по банков път
            </Btn>
          </div>
        ) : undefined
      }
    >
      <TopBar
        onBack={() => go('claim', -1)}
        backLabel="Избора"
        right={
          live.length > 0 ? (
            <button
              type="button"
              onClick={() => setDetails(true)}
              className="-mr-3 h-11 cursor-pointer rounded-full px-4 text-[16px] font-medium text-(--b-muted) hover:text-(--b-text) lg:hidden"
            >
              Детайли
            </button>
          ) : undefined
        }
      />

      {amount === 0 ? (
        <div className="pt-16">
          <p className="b-question text-[30px]">Няма какво да платите.</p>
          <p className="mt-3 text-[17px] text-(--b-muted)">
            Изберете за кого плащате или се върнете към избора.
          </p>
        </div>
      ) : (
        <div className="flex min-h-[52dvh] flex-col justify-center pt-6">
          <p className="text-[19px] text-(--b-muted)">
            Да преведете на {host?.name}
          </p>
          <Money
            cents={amount}
            className="b-display mt-3 block text-[96px] sm:text-[120px]"
            euroClassName="text-[0.45em]"
          />
        </div>
      )}

      <button
        type="button"
        aria-expanded={forOpen}
        onClick={() => setForOpen(!forOpen)}
        className="-ml-3 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-[17px] text-(--b-text) hover:bg-(--b-fill)"
      >
        За {forLabel || 'никого'}
        <ChevronDownIcon
          className={cn(
            'size-4 text-(--b-muted) transition-transform',
            forOpen && 'rotate-180',
          )}
          strokeWidth={STROKE}
        />
      </button>
      <Reveal show={forOpen}>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ...payable.filter((p) => mySeatIds.includes(p.participantId)),
            ...others,
          ].map((p) => {
            const on = selected.includes(p.participantId)
            return (
              <button
                key={p.participantId}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setSelected(
                    on
                      ? selected.filter((x) => x !== p.participantId)
                      : [...selected, p.participantId],
                  )
                }
                className={cn(
                  'inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-[16px] font-semibold transition-colors',
                  on
                    ? 'bg-(--b-text) text-(--b-bg)'
                    : 'bg-(--b-fill) text-(--b-text)',
                )}
              >
                {p.participantId === state.guestSeatId ? 'Вие' : p.name}
                <Eur
                  cents={p.remainingCents}
                  className="font-normal opacity-70"
                />
              </button>
            )
          })}
        </div>
        {others.length > 0 && (
          <p className="mt-3 text-[15px] text-(--b-muted)">
            Може да платите и за някой друг от масата.
          </p>
        )}
      </Reveal>

      <BSheet
        open={revolut}
        onOpenChange={setRevolut}
        title="Върнахте се от Revolut?"
      >
        <p className="text-[18px] leading-snug">
          Отворихме Revolut с <Eur cents={amount} className="font-semibold" />{' '}
          към @{HOST_PAYOUT.revolutTag}. Ако преводът мина, кажете на{' '}
          {host?.name}.
        </p>
        <div className="mt-8 flex flex-col gap-1">
          <Btn onClick={paid}>Платих</Btn>
          <Btn variant="quiet" onClick={() => setRevolut(false)}>
            Не още
          </Btn>
        </div>
      </BSheet>

      <BSheet open={iban} onOpenChange={setIban} title="По банков път">
        <dl className="space-y-5">
          {[
            ['Получател', HOST_PAYOUT.holder],
            ['IBAN', HOST_PAYOUT.iban],
            ['Сума', null],
            ['Основание', reference],
          ].map(([k, val]) => (
            <div key={k} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <dt className="text-[14px] text-(--b-muted)">{k}</dt>
                <dd className="b-num text-[18px]">
                  {val ?? <Eur cents={amount} />}
                </dd>
              </div>
              {k !== 'Получател' && (
                <button
                  type="button"
                  aria-label={`Копирай ${k}`}
                  onClick={() =>
                    copy(
                      k ?? '',
                      val ?? (amount / 100).toFixed(2).replace('.', ','),
                    )
                  }
                  className="grid size-11 cursor-pointer place-items-center rounded-full bg-(--b-fill) text-(--b-muted) hover:text-(--b-text)"
                >
                  {copied === k ? (
                    <CheckIcon
                      className="size-4 text-(--b-accent)"
                      strokeWidth={2.25}
                    />
                  ) : (
                    <CopyIcon className="size-4" strokeWidth={STROKE} />
                  )}
                </button>
              )}
            </div>
          ))}
        </dl>
        <Btn className="mt-8" onClick={paid}>
          Платих
        </Btn>
      </BSheet>

      <BSheet open={details} onOpenChange={setDetails} title="Какво плащате">
        <Breakdown ids={live} />
      </BSheet>
    </FocusLayout>
  )
}

export function GuestDone({
  paidFor,
  onBack,
}: {
  paidFor: string[]
  onBack: () => void
}) {
  const { derived, dispatch } = useProto()
  const host = derived.seats.find((s) => s.isHost)
  const seats = derived.seats.filter((s) => paidFor.includes(s.participantId))
  const pending = seats.filter((s) => s.pendingCents > 0)
  const confirmed =
    pending.length === 0 && seats.some((s) => s.totals.paidCents > 0)
  const amount =
    pending.length > 0
      ? pending.reduce((s, x) => s + x.pendingCents, 0)
      : seats.reduce((s, x) => s + x.totals.paidCents, 0)
  const cancelled = pending.length === 0 && !confirmed

  return (
    <FocusLayout
      bottom={
        <Btn variant="secondary" onClick={onBack}>
          {confirmed
            ? 'Обратно към сметката'
            : cancelled
              ? 'Към избора'
              : 'Обратно към сметката'}
        </Btn>
      }
    >
      <TopBar title={derived.bill.restaurantName} />
      <div className="flex min-h-[60dvh] flex-col justify-center">
        <span
          className={cn(
            'grid size-16 place-items-center rounded-full transition-colors',
            confirmed
              ? 'bg-(--b-accent) text-(--b-accent-ink)'
              : 'text-(--b-text) shadow-[inset_0_0_0_1.5px_var(--b-text)]',
          )}
          aria-hidden
        >
          {confirmed ? (
            <CheckIcon className="size-8" strokeWidth={2} />
          ) : (
            <ClockIcon className="size-7" strokeWidth={STROKE} />
          )}
        </span>
        <h1 className="b-question mt-8 text-[38px]" aria-live="polite">
          {confirmed
            ? `${host?.name} потвърди. Готово.`
            : cancelled
              ? `${host?.name} още не вижда превода.`
              : `Чакаме ${host?.name} да потвърди.`}
        </h1>
        <Money
          cents={amount}
          className="b-display mt-6 block text-[64px] text-(--b-muted)"
        />
        <p className="mt-4 max-w-[34ch] text-[17px] text-(--b-muted)">
          {confirmed
            ? 'Вие сте наред. Хубава вечер.'
            : cancelled
              ? 'Ако сте превели, кажете му на масата.'
              : 'Ще видите тук, щом го направи. Може да затворите страницата.'}
        </p>
        {!confirmed && !cancelled && (
          <Btn
            variant="quiet"
            className="mt-6 -ml-3 self-start"
            onClick={() => {
              dispatch({
                type: 'cancelReport',
                participantIds: pending.map((p) => p.participantId),
              })
              onBack()
            }}
          >
            Отмени „Платих“
          </Btn>
        )}
      </div>
    </FocusLayout>
  )
}
