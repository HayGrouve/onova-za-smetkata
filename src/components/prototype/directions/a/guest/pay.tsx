/**
 * PROTOTYPE — Direction A guest Pay: total first, who you pay for, breakdown
 * collapsed, IBAN fallback, pinned Revolut button and explicit „Платих“.
 */
import { useState } from 'react'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CopyIcon,
  ExternalLinkIcon,
  LockIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { HOST_PAYOUT } from '../../mock/data.ts'
import { formatEur, useProto } from '../../mock/store.tsx'
import {
  Btn,
  Group,
  GroupLabel,
  IconBtn,
  Money,
  STROKE,
  copyText,
  useFlash,
} from '../ui.tsx'

export function Pay({
  onBack,
  onReported,
}: {
  onBack: () => void
  onReported: () => void
}) {
  const { derived, mySeatIds, dispatch } = useProto()
  const { bill } = derived
  const me = mySeatIds[0]
  const payable = (id: string) => {
    const s = derived.seats.find((x) => x.participantId === id)
    return !!s && s.remainingCents > 0 && s.pendingCents === 0
  }
  const own = mySeatIds.filter(payable)
  const optional = derived.guests.filter(
    (g) => !mySeatIds.includes(g.participantId) && payable(g.participantId),
  )
  const [extra, setExtra] = useState<string[]>([])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [opened, setOpened] = useState(false)
  const [flashKey, flash] = useFlash()

  const selected = [...own, ...extra.filter(payable)]
  const amount = selected.reduce(
    (s, id) =>
      s +
      (derived.seats.find((x) => x.participantId === id)?.remainingCents ?? 0),
    0,
  )
  const host = derived.seats.find((s) => s.isHost)
  const reference = `${bill.restaurantName || 'Сметка'}, ${selected.map((id) => derived.labels[id]).join(', ')}`

  function report() {
    dispatch({ type: 'reportPaid', participantIds: selected, by: me })
    onReported()
  }

  return (
    <div className="pb-48 md:pb-16">
      <div className="sticky top-0 z-20 bg-(--a-bg)">
        <div className="mx-auto flex h-14 max-w-[520px] items-center gap-1 px-2">
          <IconBtn label="Назад към артикулите" onClick={onBack}>
            <ChevronLeftIcon strokeWidth={STROKE} />
          </IconBtn>
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">
            Плащане
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-[520px] px-4 md:mt-6 md:rounded-[14px] md:border md:border-(--a-hairline) md:bg-(--a-surface) md:p-8">
        {amount === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[17px] font-semibold">Нямате нищо за плащане</p>
            <p className="mt-1 text-[15px] text-(--a-muted)">
              Върнете се и натиснете + до това, което сте яли.
            </p>
            <Btn className="mt-5" variant="secondary" onClick={onBack}>
              Към артикулите
            </Btn>
          </div>
        ) : (
          <>
            {/* Total first */}
            <section className="pt-2 pb-6 text-center md:pt-0">
              <p className="text-[15px] text-(--a-muted)">
                За плащане на {host?.name ?? 'домакина'}
              </p>
              <p className="mt-1 text-[44px] leading-none font-semibold tracking-[-0.02em]">
                <Money cents={amount} />
              </p>
              <p className="mt-2 text-[13px] text-(--a-muted)">
                с бакшиш {bill.tipPercent} %
              </p>
            </section>

            {derived.unclaimedUnits > 0 && (
              <div className="mb-6 flex items-start gap-2.5 rounded-[14px] bg-[color-mix(in_oklch,var(--a-pending-strong)_14%,transparent)] px-4 py-3 text-[13px]">
                <TriangleAlertIcon
                  strokeWidth={STROKE}
                  className="mt-0.5 size-4 shrink-0 text-(--a-pending)"
                />
                <p>
                  На масата има още{' '}
                  {derived.unclaimedUnits === 1
                    ? '1 свободна бройка'
                    : `${derived.unclaimedUnits} свободни бройки`}
                  . Ако някоя е ваша,{' '}
                  <button
                    type="button"
                    className="font-semibold text-(--a-accent) underline-offset-2 hover:underline"
                    onClick={onBack}
                  >
                    отбележете я
                  </button>{' '}
                  преди да платите.
                </p>
              </div>
            )}

            <section>
              <GroupLabel>За кого плащате</GroupLabel>
              <Group>
                {own.map((id) => (
                  <div key={id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex size-5 items-center justify-center rounded-[5px] bg-(--a-accent) text-(--a-on-accent)">
                      <CheckIcon className="size-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="flex-1 text-[15px] font-medium">
                      {derived.labels[id]}
                      {id === me && (
                        <span className="font-normal text-(--a-muted)">
                          {' '}
                          (вие)
                        </span>
                      )}
                    </span>
                    <Money
                      cents={
                        derived.seats.find((s) => s.participantId === id)
                          ?.remainingCents ?? 0
                      }
                      className="font-semibold"
                    />
                    <LockIcon
                      strokeWidth={STROKE}
                      className="size-3.5 text-(--a-muted)"
                      aria-label="Винаги включено"
                    />
                  </div>
                ))}
                {optional.map((g) => {
                  const on = extra.includes(g.participantId)
                  return (
                    <label
                      key={g.participantId}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-(--a-surface-2)"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setExtra(
                            on
                              ? extra.filter((x) => x !== g.participantId)
                              : [...extra, g.participantId],
                          )
                        }
                        className="size-5 accent-(--a-accent)"
                      />
                      <span className="flex-1 text-[15px]">{g.name}</span>
                      <Money
                        cents={g.remainingCents}
                        className={cn(
                          on ? 'font-semibold' : 'text-(--a-muted)',
                        )}
                      />
                      <span className="w-3.5" />
                    </label>
                  )
                })}
              </Group>
            </section>

            <section className="mt-4">
              <button
                type="button"
                aria-expanded={showBreakdown}
                onClick={() => setShowBreakdown((s) => !s)}
                className="flex w-full items-center justify-between rounded-[10px] px-1 py-2 text-[15px] font-medium"
              >
                Какво включва
                <ChevronDownIcon
                  strokeWidth={STROKE}
                  className={cn(
                    'size-[18px] text-(--a-muted) transition-transform',
                    showBreakdown && 'rotate-180',
                  )}
                />
              </button>
              {showBreakdown && (
                <div className="mt-1 flex flex-col gap-4">
                  {selected.map((id) => {
                    const v = derived.shareView(id)
                    return (
                      <div key={id}>
                        {selected.length > 1 && (
                          <p className="mb-1 px-1 text-[13px] font-medium text-(--a-muted)">
                            {derived.labels[id]}
                          </p>
                        )}
                        <Group>
                          {v.lines.map((l) => (
                            <div
                              key={l.key}
                              className="flex items-baseline gap-3 px-4 py-2.5 text-[15px]"
                            >
                              <span className="min-w-0 flex-1">
                                {l.label}
                                {(l.unitsText || l.sharedText) && (
                                  <span className="block text-[13px] text-(--a-muted)">
                                    {[l.unitsText, l.sharedText]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </span>
                                )}
                              </span>
                              <Money cents={l.amountCents} />
                            </div>
                          ))}
                        </Group>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="mt-6">
              <GroupLabel>Или по банков път</GroupLabel>
              <Group>
                <CopyRow
                  label="IBAN"
                  value={HOST_PAYOUT.iban}
                  mono
                  flashKey={flashKey}
                  onCopy={() => flash('iban')}
                  k="iban"
                />
                <div className="px-4 py-3">
                  <p className="text-[13px] text-(--a-muted)">Получател</p>
                  <p className="text-[15px]">{HOST_PAYOUT.holder}</p>
                </div>
                <CopyRow
                  label="Основание"
                  value={reference}
                  flashKey={flashKey}
                  onCopy={() => flash('ref')}
                  k="ref"
                />
              </Group>
            </section>
          </>
        )}

        {amount > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-(--a-hairline) bg-(--a-surface) px-4 pt-3 pb-[max(env(safe-area-inset-bottom),14px)] shadow-(--a-sheet-shadow) md:static md:mt-8 md:border-0 md:p-0 md:shadow-none">
            <div className="mx-auto flex max-w-[520px] flex-col gap-2">
              {opened ? (
                <>
                  <p className="text-center text-[13px] text-(--a-muted)">
                    Отворихме Revolut с {formatEur(amount)} и основание. Върнете
                    се, когато платите.
                  </p>
                  <Btn size="lg" onClick={report}>
                    <CheckIcon strokeWidth={2} />
                    Платих {formatEur(amount)}
                  </Btn>
                  <Btn
                    size="md"
                    variant="quiet"
                    onClick={() => setOpened(true)}
                  >
                    <ExternalLinkIcon strokeWidth={STROKE} />
                    Отвори Revolut пак
                  </Btn>
                </>
              ) : (
                <>
                  <Btn size="lg" onClick={() => setOpened(true)}>
                    Плати с Revolut
                    <span className="tabular-nums opacity-80">
                      {formatEur(amount)}
                    </span>
                  </Btn>
                  <Btn size="md" variant="quiet" onClick={report}>
                    Вече платих по банков път
                  </Btn>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CopyRow({
  label,
  value,
  mono,
  flashKey,
  onCopy,
  k,
}: {
  label: string
  value: string
  mono?: boolean
  flashKey: string | null
  onCopy: () => void
  k: string
}) {
  return (
    <div className="flex items-center gap-3 py-2 pr-2 pl-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-(--a-muted)">{label}</p>
        <p
          className={cn(
            'text-[15px] break-words',
            mono && 'a-mono text-[13px] tracking-tight',
          )}
        >
          {value}
        </p>
      </div>
      <Btn
        size="sm"
        variant="quiet"
        aria-label={`Копирай ${label}`}
        onClick={() => {
          copyText(value)
          onCopy()
        }}
      >
        {flashKey === k ? (
          <CheckIcon strokeWidth={2} />
        ) : (
          <CopyIcon strokeWidth={STROKE} />
        )}
        {flashKey === k ? 'Копирано' : 'Копирай'}
      </Btn>
    </div>
  )
}
