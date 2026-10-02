/** PROTOTYPE — Direction A guest Done: waiting for the host, then confirmed. */
import { CheckIcon, ClockIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { useProto } from '../../mock/store.tsx'
import { Btn, Group, Money, Pill, STROKE } from '../ui.tsx'

export function Done({ onBack }: { onBack: () => void }) {
  const { derived, mySeatIds, dispatch } = useProto()
  const host = derived.seats.find((s) => s.isHost)?.name ?? 'домакина'
  const mine = derived.seats.filter((s) => mySeatIds.includes(s.participantId))
  const pendingSeats = mine.filter((s) => s.pendingCents > 0)
  const pending = pendingSeats.reduce((s, x) => s + x.pendingCents, 0)
  const paid = mine.reduce((s, x) => s + x.totals.paidCents, 0)
  const remaining = mine.reduce((s, x) => s + x.remainingCents, 0)
  const confirmed = pending === 0 && paid > 0 && remaining === 0

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[460px] flex-col px-4 pt-16 pb-10 md:pt-24">
      <div className="flex flex-col items-center text-center md:rounded-[14px] md:border md:border-(--a-hairline) md:bg-(--a-surface) md:p-10">
        <span
          className={cn(
            'flex size-14 items-center justify-center rounded-full',
            confirmed
              ? 'bg-[color-mix(in_oklch,var(--a-paid)_15%,transparent)] text-(--a-paid)'
              : 'bg-[color-mix(in_oklch,var(--a-pending-strong)_18%,transparent)] text-(--a-pending)',
          )}
        >
          {confirmed ? (
            <CheckIcon className="size-7" strokeWidth={2.25} />
          ) : (
            <ClockIcon className="size-7" strokeWidth={STROKE} />
          )}
        </span>
        <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.01em]">
          {confirmed
            ? `${host} потвърди плащането`
            : pending > 0
              ? `Известихме ${host}`
              : 'Нищо не чака'}
        </h1>
        <p className="mt-2 text-[32px] leading-none font-semibold tracking-[-0.02em]">
          <Money cents={confirmed ? paid : pending} />
        </p>
        <Pill tone={confirmed ? 'paid' : 'pending'} dot className="mt-4">
          {confirmed ? 'Платено' : 'Чака потвърждение'}
        </Pill>
        <p className="mt-4 max-w-[34ch] text-[15px] text-(--a-muted)">
          {confirmed
            ? 'Готово. Нищо не дължите за тази сметка.'
            : `Ще се появи тук, когато ${host} види парите и потвърди.`}
        </p>

        {mine.length > 1 && (
          <Group className="mt-6 w-full text-left">
            {mine.map((s) => (
              <div
                key={s.participantId}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="flex-1 text-[15px]">{s.name}</span>
                <Money
                  cents={s.pendingCents || s.totals.paidCents}
                  className="font-semibold"
                />
                <Pill
                  tone={
                    s.pendingCents > 0
                      ? 'pending'
                      : s.remainingCents === 0
                        ? 'paid'
                        : 'due'
                  }
                  className="h-5 px-2 text-[11px]"
                >
                  {s.pendingCents > 0
                    ? 'Чака'
                    : s.remainingCents === 0
                      ? 'Платено'
                      : 'Дължи'}
                </Pill>
              </div>
            ))}
          </Group>
        )}

        <div className="mt-8 flex w-full flex-col gap-2">
          <Btn size="lg" variant="secondary" onClick={onBack}>
            Към сметката
          </Btn>
          {pending > 0 && (
            <Btn
              size="md"
              variant="danger"
              onClick={() => {
                dispatch({
                  type: 'cancelReport',
                  participantIds: pendingSeats.map((s) => s.participantId),
                })
                onBack()
              }}
            >
              Отмени „Платих“
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}
