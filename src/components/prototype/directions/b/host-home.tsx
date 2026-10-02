/**
 * PROTOTYPE - Direction B host home: one „next thing“ in large type, derived
 * from real state, then a quiet list of the other bills and „Нова сметка“.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronRightIcon, PlusIcon } from 'lucide-react'
import { useProto } from '../mock/store.tsx'
import { useLiveTable } from '../mock/live.ts'
import { HOME_BILLS } from '../mock/data.ts'
import type { MockHomeBill } from '../mock/data.ts'
import { hostFocus, reminderText } from './focus.ts'
import {
  Btn,
  Eur,
  FocusLayout,
  Money,
  STROKE,
  TopBar,
  plural,
  useCopy,
} from './ui.tsx'
import type { GoHost } from './routes.ts'

const DAY = 86_400_000

export function relDay(ts: number) {
  const days = Math.floor((Date.now() - ts) / DAY)
  if (days <= 0) return 'днес'
  if (days === 1) return 'вчера'
  return `преди ${days} дни`
}

export function HostHome({ go }: { go: GoHost }) {
  useLiveTable(true)
  const { derived, dispatch } = useProto()
  const reduce = useReducedMotion()
  const [copied, copy] = useCopy()
  const focus = hostFocus(derived)
  const fallbackDebtor = HOME_BILLS.find(
    (b) => b.status === 'draft' && b.debtors.length > 0,
  )

  let key: string = focus.kind
  let sentence: ReactNode
  let context = derived.bill.restaurantName || 'Нова сметка'
  let actions: ReactNode
  let detail: ReactNode = null

  switch (focus.kind) {
    case 'confirm':
      key = `confirm-${focus.seat.participantId}`
      sentence = (
        <>
          Потвърди <Money cents={focus.seat.pendingCents} /> от{' '}
          {focus.seat.name}?
        </>
      )
      actions = (
        <>
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
        </>
      )
      break
    case 'unclaimed':
      sentence = (
        <>
          {focus.units} {plural(focus.units, 'бройка', 'бройки')} без собственик
        </>
      )
      detail = (
        <>
          <Eur cents={focus.cents} /> общо, {context}
        </>
      )
      actions = <Btn onClick={() => go({ name: 'live' })}>Отвори сметката</Btn>
      break
    case 'invite':
    case 'remind':
      key = `${focus.kind}-${focus.seat.participantId}`
      sentence =
        focus.kind === 'invite' ? (
          <>Линкът чака {focus.seat.name}</>
        ) : (
          <>
            {focus.seat.name} ви дължи{' '}
            <Money cents={focus.seat.remainingCents} />
          </>
        )
      actions = (
        <>
          <Btn onClick={() => copy(key, reminderText(derived, focus.seat))}>
            {copied === key
              ? 'Копирано, пратете го'
              : `Напомни на ${focus.seat.name}`}
          </Btn>
          <Btn variant="quiet" onClick={() => go({ name: 'live' })}>
            Към сметката
          </Btn>
        </>
      )
      break
    case 'close':
      sentence = <>Всички платиха</>
      detail = <>{context} е готова за приключване</>
      actions = (
        <>
          <Btn onClick={() => dispatch({ type: 'finalize' })}>Приключи</Btn>
          <Btn variant="quiet" onClick={() => go({ name: 'live' })}>
            Към сметката
          </Btn>
        </>
      )
      break
    case 'empty':
      sentence = <>Сметката още е празна</>
      actions = (
        <Btn onClick={() => go({ name: 'new', step: 'scan' })}>
          Снимай бележката
        </Btn>
      )
      break
    case 'final':
      if (fallbackDebtor) {
        const d = fallbackDebtor.debtors[0]
        key = `old-${d.name}`
        context = fallbackDebtor.restaurantName ?? 'Чернова'
        sentence = (
          <>
            {d.name} ви дължи <Money cents={d.cents} />
          </>
        )
        actions = (
          <Btn
            onClick={() =>
              copy(
                key,
                `Здрасти, ${d.name}! За ${context} се падат ${(d.cents / 100).toFixed(2).replace('.', ',')} €.`,
              )
            }
          >
            {copied === key ? 'Копирано, пратете го' : `Напомни на ${d.name}`}
          </Btn>
        )
      } else {
        sentence = <>Всичко е върнато</>
        detail = <>Няма кого да гоните.</>
      }
      break
  }

  const focusedBillId =
    focus.kind === 'final' ? (fallbackDebtor?._id ?? null) : derived.bill._id
  const list = <BillList go={go} excludeId={focusedBillId} />

  return (
    <FocusLayout
      context={
        <div>
          <p className="mb-4 text-[17px] font-semibold">Сметките ви</p>
          {list}
        </div>
      }
      bottom={
        <Btn
          variant="secondary"
          onClick={() => {
            dispatch({ type: 'newBill' })
            go({ name: 'new', step: 'scan' })
          }}
        >
          <PlusIcon className="size-5" strokeWidth={STROKE} />
          Нова сметка
        </Btn>
      }
    >
      <TopBar
        title={
          <span className="font-semibold text-(--b-text)">
            Онова за сметката
          </span>
        }
      />
      <p className="mt-6 text-[17px] text-(--b-muted)">Добър вечер, Даниел.</p>

      <div className="mt-6 rounded-[28px] bg-(--b-surface) p-7 sm:p-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={key}
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -10 }}
            transition={{ duration: 0.25 }}
          >
            <p className="b-question text-[30px] sm:text-[32px]">{sentence}</p>
            <p className="mt-3 text-[17px] text-(--b-muted)">
              {detail ?? context}
            </p>
            {actions && (
              <div className="mt-8 flex flex-col items-stretch gap-1">
                {actions}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-14 lg:hidden">
        <p className="mb-2 text-[17px] font-semibold">Сметките ви</p>
        {list}
      </div>
    </FocusLayout>
  )
}

function BillList({ go, excludeId }: { go: GoHost; excludeId: string | null }) {
  const { derived } = useProto()
  const [open, setOpen] = useState<string | null>(null)
  const [copied, copy] = useCopy()
  const current = derived.bill
  const currentMeta =
    current.status === 'final'
      ? 'Приключена'
      : derived.totalUnits === 0
        ? 'Чернова'
        : derived.unclaimedUnits > 0
          ? `${derived.unclaimedUnits} ${plural(derived.unclaimedUnits, 'бройка без собственик', 'бройки без собственик')}`
          : derived.outstandingCents > 0
            ? 'Чакате пари'
            : 'Всички платиха'

  return (
    <ul className="-mx-3">
      {excludeId !== current._id && (
        <li>
          <button
            type="button"
            onClick={() =>
              go(
                derived.totalUnits === 0 && current.status !== 'final'
                  ? { name: 'new', step: 'scan' }
                  : { name: 'live' },
              )
            }
            className="flex w-full cursor-pointer items-center gap-4 rounded-[20px] px-3 py-4 text-left hover:bg-(--b-fill)"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[18px] font-medium">
                {current.restaurantName || 'Нова сметка'}
              </span>
              <span className="block text-[15px] text-(--b-muted)">
                {relDay(current.date)}, {currentMeta}
              </span>
            </span>
            {derived.outstandingCents > 0 && (
              <Eur cents={derived.outstandingCents} className="text-[17px]" />
            )}
            <ChevronRightIcon
              className="size-5 text-(--b-muted)"
              strokeWidth={STROKE}
            />
          </button>
        </li>
      )}
      {HOME_BILLS.filter((b) => b._id !== excludeId).map((b) => (
        <li key={b._id}>
          <OtherBill
            bill={b}
            open={open === b._id}
            onToggle={() => setOpen(open === b._id ? null : b._id)}
            copied={copied}
            copy={copy}
          />
        </li>
      ))}
    </ul>
  )
}

function OtherBill({
  bill,
  open,
  onToggle,
  copied,
  copy,
}: {
  bill: MockHomeBill
  open: boolean
  onToggle: () => void
  copied: string | null
  copy: (k: string, t: string) => void
}) {
  const name = bill.restaurantName ?? `Чернова от ${relDay(bill.date)}`
  const meta =
    bill.status === 'final'
      ? `${relDay(bill.date)}, приключена`
      : bill.unassignedUnits > 0
        ? `${relDay(bill.date)}, ${bill.unassignedUnits} бройки без собственик`
        : `${relDay(bill.date)}, ${bill.debtors.length} ${plural(bill.debtors.length, 'човек дължи', 'души дължат')}`
  const expandable = bill.debtors.length > 0
  return (
    <div className={open ? 'rounded-[20px] bg-(--b-fill)' : ''}>
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        aria-expanded={expandable ? open : undefined}
        className={`flex w-full items-center gap-4 rounded-[20px] px-3 py-4 text-left ${expandable ? 'cursor-pointer hover:bg-(--b-fill)' : 'cursor-default'}`}
      >
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[18px] font-medium ${bill.status === 'final' ? 'text-(--b-muted)' : ''}`}
          >
            {name}
          </span>
          <span className="block text-[15px] text-(--b-muted)">{meta}</span>
        </span>
        {bill.outstandingCents > 0 ? (
          <Eur cents={bill.outstandingCents} className="text-[17px]" />
        ) : (
          <Eur
            cents={bill.totalCents}
            className="text-[15px] text-(--b-muted)"
          />
        )}
      </button>
      {open && (
        <ul className="px-3 pb-3">
          {bill.debtors.map((d) => {
            const k = `${bill._id}-${d.name}`
            return (
              <li key={d.name} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-[17px]">{d.name}</span>
                <Eur cents={d.cents} className="text-[17px]" />
                <Btn
                  variant="outline"
                  className="h-10 px-4 text-[15px]"
                  onClick={() =>
                    copy(
                      k,
                      `Здрасти, ${d.name}! За ${name} се падат ${(d.cents / 100).toFixed(2).replace('.', ',')} €.`,
                    )
                  }
                >
                  {copied === k ? 'Копирано' : 'Напомни'}
                </Btn>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
