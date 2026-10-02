/** PROTOTYPE — Direction A guest Join: „Кой сте вие?“ with taken seats and „Няма ме в списъка“. */
import { useState } from 'react'
import { ChevronRightIcon, UserPlusIcon } from 'lucide-react'
import { useProto } from '../../mock/store.tsx'
import {
  Avatar,
  Btn,
  Field,
  Group,
  Money,
  Pill,
  STROKE,
  TextInput,
} from '../ui.tsx'

export function Join({ onJoined }: { onJoined: () => void }) {
  const { derived, dispatch } = useProto()
  const { bill } = derived
  const host = derived.seats.find((s) => s.isHost)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function joinNew() {
    const n = name.trim()
    if (!n) return setError('Въведете името си')
    const clash = derived.seats.find(
      (s) => s.name.toLocaleLowerCase('bg') === n.toLocaleLowerCase('bg'),
    )
    if (clash)
      return setError(
        `${clash.name} вече е в списъка. Ако сте вие, изберете името отгоре.`,
      )
    dispatch({ type: 'joinAsNew', name: n })
    onJoined()
  }

  return (
    <div className="mx-auto w-full max-w-[460px] px-4 pt-6 pb-16 md:pt-16">
      <div className="md:rounded-[14px] md:border md:border-(--a-hairline) md:bg-(--a-surface) md:p-8">
        <p className="text-[13px] font-medium text-(--a-muted)">
          Онова за сметката
        </p>
        <h1 className="mt-4 text-[22px] leading-tight font-semibold tracking-[-0.01em]">
          {bill.restaurantName || 'Сметка'}
        </h1>
        <p className="mt-1 text-[15px] text-(--a-muted)">
          {host?.name ?? 'Домакинът'} плати сметката от{' '}
          <Money cents={derived.totals.billTotalCents} /> и ви покани да
          отбележите своето.
        </p>

        <h2 className="mt-8 text-[17px] font-semibold">Кой сте вие?</h2>
        <Group className="mt-3">
          {derived.seats.map((s) => {
            const taken = s.isHost || s.phoneSeatId !== null
            const byOther =
              s.phoneSeatId && s.phoneSeatId !== s.participantId
                ? derived.labels[s.phoneSeatId]
                : null
            return (
              <button
                key={s.participantId}
                type="button"
                disabled={taken}
                onClick={() => {
                  dispatch({ type: 'pickSeat', participantId: s.participantId })
                  onJoined()
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--a-surface-2) disabled:hover:bg-transparent"
              >
                <Avatar name={s.name} muted={taken} />
                <span
                  className={
                    taken
                      ? 'flex-1 text-[15px] text-(--a-muted)'
                      : 'flex-1 text-[15px] font-medium'
                  }
                >
                  {s.name}
                  {s.isHost && ', домакин'}
                </span>
                {taken ? (
                  <Pill tone="neutral">
                    {byOther ? `Заето, с ${byOther}` : 'Заето'}
                  </Pill>
                ) : (
                  <ChevronRightIcon
                    strokeWidth={STROKE}
                    className="size-[18px] text-(--a-muted)"
                  />
                )}
              </button>
            )
          })}
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-medium text-(--a-accent) hover:bg-(--a-surface-2)"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-(--a-accent-soft)">
                <UserPlusIcon strokeWidth={STROKE} className="size-4" />
              </span>
              Няма ме в списъка
            </button>
          ) : (
            <form
              noValidate
              className="flex flex-col gap-3 p-4"
              onSubmit={(e) => {
                e.preventDefault()
                joinNew()
              }}
            >
              <Field label="Вашето име" htmlFor="a-guest-name" error={error}>
                <TextInput
                  id="a-guest-name"
                  autoFocus
                  value={name}
                  invalid={!!error}
                  placeholder="Например Краси"
                  autoComplete="given-name"
                  onChange={(e) => {
                    setName(e.target.value)
                    setError(null)
                  }}
                />
              </Field>
              <div className="flex gap-2">
                <Btn
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setAdding(false)}
                >
                  Отказ
                </Btn>
                <Btn type="submit" className="flex-1">
                  Влез
                </Btn>
              </div>
            </form>
          )}
        </Group>
        <p className="mt-4 text-[13px] text-(--a-muted)">
          Без регистрация. Името ви се вижда само на тази маса.
        </p>
      </div>
    </div>
  )
}
