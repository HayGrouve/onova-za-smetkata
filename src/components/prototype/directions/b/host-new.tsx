/**
 * PROTOTYPE - Direction B new bill: a focused sequence of full-screen
 * questions under a thin progress line. Scan (or type) → review → who was
 * at the table → share the link → live status.
 */
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CameraIcon,
  CheckIcon,
  CopyIcon,
  PlusIcon,
  ReceiptTextIcon,
  ShareIcon,
} from 'lucide-react'
import { parseEurInput } from '#/lib/format-currency.ts'
import { cn } from '#/lib/utils.ts'
import { useProto } from '../mock/store.tsx'
import type { MockItem } from '../mock/data.ts'
import { RECENT_FRIENDS } from '../mock/data.ts'
import { billLink } from './focus.ts'
import {
  BSheet,
  Btn,
  Eur,
  FocusLayout,
  Money,
  ProgressLine,
  Reveal,
  STROKE,
  Skel,
  TopBar,
  useCopy,
} from './ui.tsx'
import type { GoHost, NewStep } from './routes.ts'

const STEPS: NewStep[] = ['scan', 'review', 'people', 'share']

export function NewBill({ step, go }: { step: NewStep; go: GoHost }) {
  const progress = (STEPS.indexOf(step) + 1) / STEPS.length
  return (
    <>
      <ProgressLine value={progress} />
      {step === 'scan' && <ScanStep go={go} />}
      {step === 'review' && <ReviewStep go={go} />}
      {step === 'people' && <PeopleStep go={go} />}
      {step === 'share' && <ShareStep go={go} />}
    </>
  )
}

/* --------------------------------------------------------------- scan */

function ScanStep({ go }: { go: GoHost }) {
  const { state, scanReceipt } = useProto()
  const started = useRef(false)
  const scanning = state.scanning

  useEffect(() => {
    if (started.current && !scanning) go({ name: 'new', step: 'review' })
  }, [scanning, go])

  const start = () => {
    if (state.bill.items.length > 0) {
      go({ name: 'new', step: 'review' })
      return
    }
    started.current = true
    scanReceipt()
  }

  return (
    <FocusLayout
      bottom={
        scanning ? undefined : (
          <div className="flex flex-col gap-1">
            <Btn onClick={start}>
              <CameraIcon className="size-5" strokeWidth={STROKE} />
              Снимай бележката
            </Btn>
            <Btn
              variant="quiet"
              onClick={() => go({ name: 'new', step: 'review' })}
            >
              Ще въведа ръчно
            </Btn>
          </div>
        )
      }
    >
      <TopBar onBack={() => go({ name: 'home' }, -1)} backLabel="Сметки" />
      <h1 className="b-question mt-8 text-[34px]">
        {scanning ? 'Чета бележката…' : 'Снимай бележката'}
      </h1>
      <p className="mt-3 max-w-[34ch] text-[17px] text-(--b-muted)">
        {scanning
          ? 'Още малко. После ще проверите редовете.'
          : 'Ние ще прочетем редовете. Вие само ги проверявате.'}
      </p>

      {scanning ? (
        <div
          className="mt-10 rounded-[28px] bg-(--b-surface) p-7"
          aria-busy="true"
          aria-label="Чета бележката"
        >
          <Skel className="mx-auto h-5 w-1/2" />
          <div className="mt-8 space-y-5">
            {[72, 54, 64, 40, 58, 46].map((w, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skel className="h-4" />
                <div style={{ width: `${w}%` }}>
                  <Skel className="h-4 w-full" />
                </div>
                <div className="flex-1" />
                <Skel className="h-4 w-14" />
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-between">
            <Skel className="h-5 w-20" />
            <Skel className="h-5 w-20" />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          className="mt-10 grid aspect-[4/5] w-full cursor-pointer place-items-center rounded-[28px] bg-(--b-surface) text-(--b-muted) transition-colors hover:text-(--b-text)"
        >
          <span className="flex flex-col items-center gap-4">
            <span className="grid size-20 place-items-center rounded-full bg-(--b-accent-soft) text-(--b-accent)">
              <CameraIcon className="size-8" strokeWidth={STROKE} />
            </span>
            <span className="text-[17px]">Сложете бележката на масата</span>
          </span>
        </button>
      )}
    </FocusLayout>
  )
}

/* ------------------------------------------------------------- review */

function ReceiptPhoto() {
  const { derived } = useProto()
  return (
    <div className="rounded-[28px] bg-(--b-surface) p-6 text-[14px] leading-6">
      <p className="mb-1 text-[13px] text-(--b-muted)">Снимката на бележката</p>
      <p className="text-center font-semibold uppercase">
        {derived.bill.restaurantName || 'Бележка'}
      </p>
      <div className="mt-4 space-y-0.5">
        {derived.bill.items.map((i) => (
          <div key={i._id} className="b-num flex gap-2">
            <span className="w-6 text-(--b-muted)">{i.quantity}x</span>
            <span className="flex-1 truncate uppercase">{i.name}</span>
            <span>{((i.unitPriceCents * i.quantity) / 100).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="b-num mt-4 flex justify-between font-semibold">
        <span>ОБЩО</span>
        <span>{(derived.subtotalCents / 100).toFixed(2)}</span>
      </div>
    </div>
  )
}

function ReviewStep({ go }: { go: GoHost }) {
  const { derived, dispatch } = useProto()
  const items = derived.bill.items
  const scanned = items.some((i) => i._id.startsWith('i-scan-'))
  const [editing, setEditing] = useState<string | null>(
    items.length === 0 ? 'new' : null,
  )
  const [receiptTotal, setReceiptTotal] = useState(
    scanned ? (derived.subtotalCents / 100).toFixed(2).replace('.', ',') : '',
  )
  const [photoOpen, setPhotoOpen] = useState(false)
  const totalCents = parseEurInput(receiptTotal)
  const diff = totalCents - derived.subtotalCents
  const name = derived.bill.restaurantName

  return (
    <FocusLayout
      context={scanned ? <ReceiptPhoto /> : undefined}
      bottom={
        <div>
          {items.length > 0 && (
            <p className="b-num mb-3 flex items-center justify-center gap-2 text-[15px] text-(--b-muted)">
              Сума на редовете{' '}
              <Eur cents={derived.subtotalCents} className="text-(--b-text)" />
              {receiptTotal.trim() !== '' &&
                (diff === 0 ? (
                  <CheckIcon
                    className="size-4 text-(--b-accent)"
                    strokeWidth={2.25}
                    aria-label="съвпада"
                  />
                ) : (
                  <span className="text-(--b-warn)">не съвпада</span>
                ))}
            </p>
          )}
          <Btn
            disabled={items.length === 0}
            onClick={() => go({ name: 'new', step: 'people' })}
          >
            {items.length === 0 ? 'Добавете поне един ред' : 'Да, продължи'}
          </Btn>
        </div>
      }
    >
      <TopBar
        onBack={() => go({ name: 'new', step: 'scan' }, -1)}
        right={
          scanned ? (
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-[15px] font-medium text-(--b-muted) hover:text-(--b-text) lg:hidden"
            >
              <ReceiptTextIcon className="size-4" strokeWidth={STROKE} />
              Снимката
            </button>
          ) : undefined
        }
      />
      <h1 className="b-question mt-6 text-[34px]">
        {scanned ? 'Това ли пише на бележката?' : 'Какво поръчахте?'}
      </h1>

      <label className="mt-8 block">
        <span className="text-[15px] text-(--b-muted)">Заведение</span>
        <input
          value={name}
          onChange={(e) =>
            dispatch({ type: 'setRestaurant', name: e.target.value })
          }
          placeholder="Например Механа Чучура"
          className="mt-1 block w-full border-b-[1.5px] border-(--b-line) bg-transparent pb-2 text-[24px] font-semibold outline-none focus:border-(--b-accent)"
        />
      </label>

      <div className="mt-10">
        {items.length === 0 && editing !== 'new' && (
          <p className="py-6 text-[17px] text-(--b-muted)">Още няма редове.</p>
        )}
        <ul className="-mx-3">
          {items.map((item) => (
            <li key={item._id}>
              {editing === item._id ? (
                <ItemEditor
                  item={item}
                  onDone={() => setEditing(null)}
                  onRemove={() => {
                    dispatch({ type: 'removeItem', itemId: item._id })
                    setEditing(null)
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(item._id)}
                  className="group flex w-full cursor-pointer items-baseline gap-3 rounded-[20px] px-3 py-3 text-left hover:bg-(--b-fill)"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[18px]">{item.name}</span>
                    <span className="b-num block text-[15px] text-(--b-muted)">
                      {item.quantity} ×{' '}
                      {(item.unitPriceCents / 100).toFixed(2).replace('.', ',')}{' '}
                      €
                    </span>
                  </span>
                  <Eur
                    cents={item.unitPriceCents * item.quantity}
                    className="text-[18px]"
                  />
                </button>
              )}
            </li>
          ))}
          {editing === 'new' && (
            <li>
              <ItemEditor onDone={() => setEditing(null)} />
            </li>
          )}
        </ul>
        {editing !== 'new' && (
          <Btn
            variant="quiet"
            className="mt-2 -ml-3"
            onClick={() => setEditing('new')}
          >
            <PlusIcon className="size-5" strokeWidth={STROKE} />
            Добави ред
          </Btn>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-10 rounded-[28px] bg-(--b-surface) p-6">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[17px] text-(--b-muted)">
              Сума на редовете
            </span>
            <Money
              cents={derived.subtotalCents}
              className="text-[28px] font-light"
            />
          </div>
          <label className="mt-5 flex items-center justify-between gap-4">
            <span className="text-[17px] text-(--b-muted)">
              Общо на бележката
            </span>
            <span className="relative">
              <input
                inputMode="decimal"
                value={receiptTotal}
                onChange={(e) => setReceiptTotal(e.target.value)}
                placeholder="0,00"
                className="b-num h-12 w-36 rounded-full bg-(--b-fill) pr-9 pl-5 text-right text-[18px] outline-none focus:ring-2 focus:ring-(--b-accent)"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-(--b-muted)">
                €
              </span>
            </span>
          </label>
          {receiptTotal.trim() !== '' && (
            <p
              className={cn(
                'mt-4 flex items-center gap-2 text-[16px]',
                diff === 0 ? 'text-(--b-accent)' : 'text-(--b-warn)',
              )}
              role="status"
            >
              {diff === 0 ? (
                <>
                  <CheckIcon className="size-4" strokeWidth={2.25} />
                  Съвпада с бележката.
                </>
              ) : (
                <>
                  Разлика <Eur cents={Math.abs(diff)} />. Някой ред липсва или е
                  грешен.
                </>
              )}
            </p>
          )}
        </div>
      )}

      <BSheet open={photoOpen} onOpenChange={setPhotoOpen} title="Снимката">
        <ReceiptPhoto />
      </BSheet>
    </FocusLayout>
  )
}

export function ItemEditor({
  item,
  onDone,
  onRemove,
}: {
  item?: MockItem
  onDone: () => void
  onRemove?: () => void
}) {
  const { dispatch } = useProto()
  const [name, setName] = useState(item?.name ?? '')
  const [qty, setQty] = useState(item?.quantity ?? 1)
  const [price, setPrice] = useState(
    item ? (item.unitPriceCents / 100).toFixed(2).replace('.', ',') : '',
  )
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const cents = parseEurInput(price)
    if (!name.trim()) return setError('Напишете какво е.')
    if (cents <= 0) return setError('Цената трябва да е над нула.')
    if (item) {
      dispatch({
        type: 'updateItem',
        itemId: item._id,
        patch: { name: name.trim(), quantity: qty, unitPriceCents: cents },
      })
    } else {
      dispatch({
        type: 'addItem',
        item: { name: name.trim(), quantity: qty, unitPriceCents: cents },
      })
    }
    onDone()
  }

  const field =
    'h-12 w-full rounded-full bg-(--b-surface) px-5 text-[17px] outline-none focus:ring-2 focus:ring-(--b-accent)'
  return (
    <form
      onSubmit={submit}
      className="my-2 rounded-[24px] bg-(--b-fill) p-4"
      noValidate
    >
      <label className="block">
        <span className="mb-1.5 block pl-1 text-[14px] text-(--b-muted)">
          Какво
        </span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
          placeholder="Шопска салата"
        />
      </label>
      <div className="mt-3 flex gap-3">
        <div className="shrink-0">
          <span className="mb-1.5 block pl-1 text-[14px] text-(--b-muted)">
            Брой
          </span>
          <div className="flex h-12 items-center rounded-full bg-(--b-surface)">
            <button
              type="button"
              aria-label="По-малко"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="h-12 w-11 cursor-pointer text-[20px] text-(--b-muted)"
            >
              −
            </button>
            <span className="b-num w-6 text-center text-[17px]">{qty}</span>
            <button
              type="button"
              aria-label="Повече"
              onClick={() => setQty(qty + 1)}
              className="h-12 w-11 cursor-pointer text-[20px] text-(--b-muted)"
            >
              +
            </button>
          </div>
        </div>
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block pl-1 text-[14px] text-(--b-muted)">
            Цена за брой, €
          </span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={cn(field, 'b-num')}
            placeholder="0,00"
            aria-invalid={error ? true : undefined}
          />
        </label>
      </div>
      {error && (
        <p className="mt-3 pl-1 text-[15px] text-(--b-warn)" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex items-center gap-2">
        <Btn type="submit" className="h-12 w-auto flex-1 text-[16px]">
          {item ? 'Запази' : 'Добави'}
        </Btn>
        {onRemove ? (
          <Btn variant="quiet" onClick={onRemove}>
            Махни реда
          </Btn>
        ) : (
          <Btn variant="quiet" onClick={onDone}>
            Отказ
          </Btn>
        )}
      </div>
    </form>
  )
}

/* ------------------------------------------------------------- people */

function PeopleStep({ go }: { go: GoHost }) {
  const { derived, dispatch } = useProto()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const guests = derived.guests
  const byName = new Map(guests.map((g) => [g.name.toLowerCase(), g]))
  const extra = guests.filter((g) => !RECENT_FRIENDS.includes(g.name))
  const tiles = [...RECENT_FRIENDS, ...extra.map((g) => g.name)]

  const toggle = (n: string) => {
    const seat = byName.get(n.toLowerCase())
    if (seat)
      dispatch({ type: 'removeParticipant', participantId: seat.participantId })
    else dispatch({ type: 'addParticipant', name: n })
  }
  const add = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('Напишете име.')
    if (byName.has(n.toLowerCase()) || n.toLowerCase() === 'даниел') {
      return setError(`${n} вече е на масата.`)
    }
    dispatch({ type: 'addParticipant', name: n })
    setName('')
    setError(null)
  }
  const count = guests.length + 1

  return (
    <FocusLayout
      context={<ReceiptPhoto />}
      bottom={
        <Btn
          disabled={guests.length === 0}
          onClick={() => go({ name: 'new', step: 'share' })}
        >
          {guests.length === 0
            ? 'Изберете поне един човек'
            : `Готово, ${count} души`}
        </Btn>
      }
    >
      <TopBar onBack={() => go({ name: 'new', step: 'review' }, -1)} />
      <h1 className="b-question mt-6 text-[34px]">Кой беше на масата?</h1>
      <p className="mt-3 text-[17px] text-(--b-muted)">
        Докоснете имената. Вие вече сте вътре.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {tiles.map((n) => {
          const on = byName.has(n.toLowerCase())
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(n)}
              className={cn(
                'flex h-20 cursor-pointer items-center justify-between rounded-[24px] px-5 text-left text-[20px] font-semibold transition-colors',
                on
                  ? 'bg-(--b-accent-soft) text-(--b-text)'
                  : 'bg-(--b-surface) text-(--b-text) hover:bg-(--b-fill-strong)',
              )}
            >
              {n}
              <span
                className={cn(
                  'grid size-7 place-items-center rounded-full transition-colors',
                  on
                    ? 'bg-(--b-accent) text-(--b-accent-ink)'
                    : 'shadow-[inset_0_0_0_1.5px_var(--b-line)]',
                )}
              >
                {on && <CheckIcon className="size-4" strokeWidth={2.5} />}
              </span>
            </button>
          )
        })}
      </div>

      <form onSubmit={add} className="mt-8" noValidate>
        <label
          htmlFor="b-new-name"
          className="mb-1.5 block pl-1 text-[15px] text-(--b-muted)"
        >
          Някой друг?
        </label>
        <div className="flex gap-2">
          <input
            id="b-new-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Име"
            className="h-14 min-w-0 flex-1 rounded-full bg-(--b-surface) px-6 text-[17px] outline-none focus:ring-2 focus:ring-(--b-accent)"
          />
          <Btn type="submit" variant="secondary" className="w-auto px-6">
            Добави
          </Btn>
        </div>
        {error && (
          <p className="mt-2 pl-1 text-[15px] text-(--b-warn)" role="alert">
            {error}
          </p>
        )}
      </form>
    </FocusLayout>
  )
}

/* -------------------------------------------------------------- share */

function ShareStep({ go }: { go: GoHost }) {
  const { derived } = useProto()
  const [copied, copy] = useCopy()
  const link = billLink(derived)
  const names = derived.guests.map((g) => g.name)

  const share = () => {
    const url = `https://${link}`
    if (typeof navigator.share === 'function') {
      void navigator
        .share({ title: derived.bill.restaurantName, url })
        .catch(() => undefined)
    }
    copy('share', url)
  }

  return (
    <FocusLayout
      bottom={
        <Btn variant="secondary" onClick={() => go({ name: 'live' })}>
          Към сметката
        </Btn>
      }
    >
      <TopBar onBack={() => go({ name: 'new', step: 'people' }, -1)} />
      <h1 className="b-question mt-6 text-[34px]">Пратете линка на масата</h1>
      <p className="mt-3 max-w-[36ch] text-[17px] text-(--b-muted)">
        {names.slice(0, -1).join(', ')}
        {names.length > 1 ? ' и ' : ''}
        {names.at(-1)} сами избират своето и плащат. Вие само потвърждавате.
      </p>

      <button
        type="button"
        onClick={share}
        className="mt-12 flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-5 rounded-full bg-(--b-accent) text-(--b-accent-ink) transition-transform active:scale-[0.98] sm:mx-auto sm:max-w-[340px]"
      >
        {copied === 'share' ? (
          <CheckIcon className="size-12" strokeWidth={1.5} />
        ) : (
          <ShareIcon className="size-12" strokeWidth={1.5} />
        )}
        <span className="text-[26px] font-semibold tracking-[-0.01em]">
          {copied === 'share' ? 'Линкът е копиран' : 'Сподели линка'}
        </span>
      </button>

      <Reveal show>
        <button
          type="button"
          onClick={() => copy('link', `https://${link}`)}
          className="mx-auto mt-8 flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-[15px] text-(--b-muted) hover:text-(--b-text)"
        >
          <span className="truncate">{link}</span>
          {copied === 'link' ? (
            <CheckIcon
              className="size-4 text-(--b-accent)"
              strokeWidth={2.25}
            />
          ) : (
            <CopyIcon className="size-4" strokeWidth={STROKE} />
          )}
        </button>
      </Reveal>
    </FocusLayout>
  )
}
