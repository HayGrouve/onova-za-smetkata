/**
 * PROTOTYPE - Direction B guest phone: one decision at a time.
 * Join („Кой сте вие?“) → claim → pay → done.
 */
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useProto } from '../mock/store.tsx'
import { cn } from '#/lib/utils.ts'
import { Btn, FocusLayout, Reveal, ScreenSwap, Skel, TopBar } from './ui.tsx'
import { GuestClaim } from './guest-claim.tsx'
import { GuestDone, GuestPay } from './guest-pay.tsx'
import type { GuestRoute } from './routes.ts'

export function GuestApp({
  route,
  dir,
  go,
  paidFor,
  setPaidFor,
}: {
  route: GuestRoute
  dir: number
  go: (r: GuestRoute, dir?: number) => void
  paidFor: string[]
  setPaidFor: (ids: string[]) => void
}) {
  const { state } = useProto()
  const joined = state.guestSeatId !== null
  const effective: GuestRoute =
    route === 'done' && paidFor.length === 0 ? 'claim' : route
  const key = joined ? effective : 'join'
  return (
    <ScreenSwap id={key} dir={dir}>
      {!joined && <Join onJoined={() => go('claim')} />}
      {joined && effective === 'claim' && <GuestClaim go={go} />}
      {joined && effective === 'pay' && (
        <GuestPay
          go={go}
          onPaid={(ids) => {
            setPaidFor(ids)
            go('done')
          }}
        />
      )}
      {joined && effective === 'done' && (
        <GuestDone
          paidFor={paidFor}
          onBack={() => {
            setPaidFor([])
            go('claim', -1)
          }}
        />
      )}
    </ScreenSwap>
  )
}

/* --------------------------------------------------------------- join */

function Join({ onJoined }: { onJoined: () => void }) {
  const { derived, state, dispatch } = useProto()
  const [loading, setLoading] = useState(true)
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 1500)
    return () => window.clearTimeout(t)
  }, [])

  const host = derived.seats.find((s) => s.isHost)
  const seats = derived.guests
  const isTaken = (id: string) => id in state.bill.seatPhones
  const allTaken =
    seats.length > 0 && seats.every((s) => isTaken(s.participantId))

  const join = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('Напишете името си.')
    const same = derived.seats.find(
      (s) => s.name.toLowerCase() === n.toLowerCase(),
    )
    if (same) {
      return setError(
        isTaken(same.participantId) || same.isHost
          ? `${same.name} вече е заето. Добавете фамилия или прякор.`
          : `${same.name} вече е в списъка. Ако сте вие, докоснете името горе.`,
      )
    }
    dispatch({ type: 'joinAsNew', name: n })
    onJoined()
  }

  if (loading) {
    return (
      <FocusLayout>
        <div className="pt-24" aria-busy="true" aria-label="Отваряме сметката">
          <Skel className="h-4 w-32" />
          <Skel className="mt-4 h-4 w-56" />
          <Skel className="mt-10 h-12 w-3/4" />
          <div className="mt-10 grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="b-skel h-24 rounded-[24px]!" />
            ))}
          </div>
        </div>
      </FocusLayout>
    )
  }

  return (
    <FocusLayout>
      <TopBar />
      <p className="mt-8 text-[17px] font-medium">
        {derived.bill.restaurantName}
      </p>
      <p className="text-[17px] text-(--b-muted)">
        {host?.name} ви покани да си разделите сметката.
      </p>
      <h1 className="b-question mt-10 text-[48px] tracking-[-0.03em]">
        Кой сте вие?
      </h1>

      {allTaken && (
        <p className="mt-6 text-[17px] text-(--b-muted)">
          Всички имена вече са заети от други телефони.
        </p>
      )}

      <div className="mt-10 grid grid-cols-2 gap-3">
        {seats.map((s) => {
          const taken = isTaken(s.participantId)
          return (
            <button
              key={s.participantId}
              type="button"
              disabled={taken}
              onClick={() => {
                dispatch({ type: 'pickSeat', participantId: s.participantId })
                onJoined()
              }}
              className={cn(
                'flex h-24 flex-col items-start justify-center rounded-[24px] px-5 text-left transition-colors',
                taken
                  ? 'cursor-not-allowed bg-transparent shadow-[inset_0_0_0_1.5px_var(--b-line)]'
                  : 'cursor-pointer bg-(--b-surface) hover:bg-(--b-fill-strong) active:scale-[0.98]',
              )}
            >
              <span
                className={cn(
                  'text-[24px] font-semibold',
                  taken && 'text-(--b-muted)',
                )}
              >
                {s.name}
              </span>
              {taken && (
                <span className="text-[15px] text-(--b-muted)">Заето</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        {!newOpen ? (
          <Btn
            variant="quiet"
            className="-ml-3"
            onClick={() => setNewOpen(true)}
          >
            Няма ме в списъка
          </Btn>
        ) : null}
        <Reveal show={newOpen}>
          <form
            onSubmit={join}
            className="mt-4 rounded-[28px] bg-(--b-surface) p-6"
            noValidate
          >
            <label
              htmlFor="b-guest-name"
              className="block text-[22px] font-semibold"
            >
              Как се казвате?
            </label>
            <p className="mt-1 text-[16px] text-(--b-muted)">
              Ще ви добавим на масата.
            </p>
            <input
              id="b-guest-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              placeholder="Име"
              aria-invalid={error ? true : undefined}
              className="mt-5 h-14 w-full rounded-full bg-(--b-fill) px-6 text-[18px] outline-none focus:ring-2 focus:ring-(--b-accent)"
            />
            {error && (
              <p className="mt-2 pl-2 text-[15px] text-(--b-warn)" role="alert">
                {error}
              </p>
            )}
            <Btn type="submit" className="mt-4">
              Влез
            </Btn>
          </form>
        </Reveal>
      </div>
    </FocusLayout>
  )
}
