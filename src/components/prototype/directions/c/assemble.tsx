/** PROTOTYPE Direction C: Сглобяване. The receipt is built on the paper itself (scan, add, edit lines, people). */
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import {
  AlertTriangle,
  Camera,
  Check,
  Minus,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { parseEurInput } from '#/lib/format-currency.ts'
import { useProto } from '../mock/store.tsx'
import type { MockItem } from '../mock/data.ts'
import { RECENT_FRIENDS, SCANNED_RECEIPT } from '../mock/data.ts'
import { SeatAvatar, formatMoney, seatIndex } from './ui.tsx'

const SCANNED_TOTAL = SCANNED_RECEIPT.items.reduce(
  (s, i) => s + i.unitPriceCents * i.quantity,
  0,
)
const TIPS = [0, 5, 10, 15]

export function AssembleLines() {
  const { state, dispatch, scanReceipt } = useProto()
  const { items } = state.bill
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const scanned = items.some((i) => i._id.startsWith('i-scan-'))

  if (state.scanning) return <PrintingSkeleton />

  if (items.length === 0 && !adding)
    return (
      <div className="my-4 border-2 border-dashed border-[var(--c-rule)] px-4 py-8 text-center">
        <p className="c-display text-[15px] font-bold">Празна бележка</p>
        <p className="mx-auto mt-2 max-w-[30ch] text-[12px] leading-relaxed text-[var(--c-ink-muted)]">
          Снимайте касовата бележка и редовете ще се отпечатат тук. Или ги
          въведете на ръка.
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            type="button"
            className="c-btn w-full max-w-[260px]"
            onClick={scanReceipt}
          >
            <Camera className="size-4" strokeWidth={1.75} aria-hidden />
            Снимай бележката
          </button>
          <button
            type="button"
            className="c-ghost w-full max-w-[260px] text-[var(--c-ink)]"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-4" strokeWidth={1.75} aria-hidden />
            Добави ред на ръка
          </button>
        </div>
      </div>
    )

  return (
    <div>
      <ul className="-mx-2">
        <AnimatePresence initial={false}>
          {items.map((item, i) =>
            editing === item._id ? (
              <LineForm
                key={item._id}
                item={item}
                onDone={() => setEditing(null)}
                onRemove={() => {
                  dispatch({ type: 'removeItem', itemId: item._id })
                  setEditing(null)
                }}
              />
            ) : (
              <motion.li
                key={item._id}
                initial={{ opacity: 0, y: -8, clipPath: 'inset(0 0 100% 0)' }}
                animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  duration: 0.3,
                  delay: item._id.startsWith('i-scan-') ? i * 0.09 : 0,
                }}
                className="list-none"
              >
                <button
                  type="button"
                  onClick={() => setEditing(item._id)}
                  className="w-full min-h-[52px] px-2 py-2 text-left hover:bg-[var(--c-paper-2)]"
                  aria-label={`Редактирай ${item.name}`}
                >
                  <span className="flex items-baseline">
                    <span className="min-w-0 font-medium">{item.name}</span>
                    <span className="c-leader" />
                    <span className="shrink-0 font-semibold">
                      {formatMoney(item.unitPriceCents * item.quantity)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--c-ink-muted)]">
                    {item.quantity} × {formatMoney(item.unitPriceCents)}
                  </span>
                </button>
              </motion.li>
            ),
          )}
        </AnimatePresence>
        {adding && <LineForm onDone={() => setAdding(false)} />}
      </ul>
      {!adding && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="c-ghost text-[var(--c-ink)]"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-4" strokeWidth={1.75} aria-hidden />
            Добави ред
          </button>
          {!scanned && (
            <button
              type="button"
              className="c-ghost text-[var(--c-ink)]"
              onClick={scanReceipt}
            >
              <Camera className="size-4" strokeWidth={1.75} aria-hidden />
              Снимай бележката
            </button>
          )}
        </div>
      )}
      {scanned && <ScanCheck />}
    </div>
  )
}

/** Sum-of-lines vs the total printed on the scanned receipt. */
function ScanCheck() {
  const { derived } = useProto()
  const diff = derived.subtotalCents - SCANNED_TOTAL
  return (
    <p
      className={cn(
        'mt-3 flex items-start gap-2 text-[11px] leading-snug',
        diff === 0
          ? 'text-[var(--c-ink-muted)]'
          : 'font-semibold text-[var(--c-ink)]',
      )}
    >
      {diff === 0 ? (
        <Check
          className="mt-px size-3.5 shrink-0"
          strokeWidth={2.25}
          aria-hidden
        />
      ) : (
        <AlertTriangle
          className="mt-px size-3.5 shrink-0 text-[var(--c-accent)]"
          strokeWidth={2}
          aria-hidden
        />
      )}
      {diff === 0
        ? `Редовете дават ${formatMoney(SCANNED_TOTAL)}, колкото е и на бележката.`
        : `Редовете дават ${formatMoney(derived.subtotalCents)}, а на бележката пише ${formatMoney(SCANNED_TOTAL)}. Проверете ${diff > 0 ? 'за излишен ред' : 'дали липсва ред'}.`}
    </p>
  )
}

function PrintingSkeleton() {
  return (
    <div className="py-2" role="status" aria-label="Четем бележката">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-muted)]">
        Четем бележката...
      </p>
      {[78, 52, 66, 44, 70, 38].map((w, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
          animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
          transition={{ delay: i * 0.22, duration: 0.25 }}
          className="flex items-center gap-3 py-2.5"
        >
          <span className="c-skel h-3 rounded-sm" style={{ width: `${w}%` }} />
          <span className="flex-1 border-b-2 border-dotted border-[var(--c-paper-2)]" />
          <span className="c-skel h-3 w-14 rounded-sm" />
        </motion.div>
      ))}
    </div>
  )
}

function LineForm({
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
  const [tried, setTried] = useState(false)
  const cents = parseEurInput(price)
  const nameErr = tried && !name.trim() ? 'Напишете какво е.' : null
  const priceErr = tried && cents <= 0 ? 'Цената трябва да е над 0.' : null

  const save = () => {
    setTried(true)
    if (!name.trim() || cents <= 0) return
    if (item)
      dispatch({
        type: 'updateItem',
        itemId: item._id,
        patch: { name: name.trim(), quantity: qty, unitPriceCents: cents },
      })
    else
      dispatch({
        type: 'addItem',
        item: { name: name.trim(), quantity: qty, unitPriceCents: cents },
      })
    onDone()
  }

  return (
    <li className="list-none border-l-[3px] border-[var(--c-ink)] bg-[var(--c-paper-2)] px-3 py-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="space-y-3"
      >
        <div>
          <label htmlFor="c-line-name" className="text-[11px] font-semibold">
            Артикул
          </label>
          <input
            id="c-line-name"
            className="c-input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="напр. Шопска салата"
            aria-invalid={!!nameErr}
            aria-describedby={nameErr ? 'c-line-name-err' : undefined}
          />
          {nameErr && (
            <p id="c-line-name-err" className="mt-1 text-[11px] font-semibold">
              {nameErr}
            </p>
          )}
        </div>
        <div className="flex items-end gap-4">
          <div>
            <span className="text-[11px] font-semibold">Брой</span>
            <div className="mt-1 flex items-center rounded-full border-2 border-[var(--c-ink)]">
              <button
                type="button"
                aria-label="Една по-малко"
                className="grid size-11 place-items-center"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="size-4" strokeWidth={2} aria-hidden />
              </button>
              <span className="c-display w-6 text-center font-bold">{qty}</span>
              <button
                type="button"
                aria-label="Още една"
                className="grid size-11 place-items-center"
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="c-line-price" className="text-[11px] font-semibold">
              Цена за брой, €
            </label>
            <input
              id="c-line-price"
              className="c-input"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0,00"
              aria-invalid={!!priceErr}
              aria-describedby={priceErr ? 'c-line-price-err' : undefined}
            />
            {priceErr && (
              <p
                id="c-line-price-err"
                className="mt-1 text-[11px] font-semibold"
              >
                {priceErr}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" className="c-ink-btn">
            <Check className="size-4" strokeWidth={2} aria-hidden />
            {item ? 'Запази' : 'Отпечатай реда'}
          </button>
          <button
            type="button"
            className="min-h-11 px-3 text-[12px] underline underline-offset-2"
            onClick={onDone}
          >
            Откажи
          </button>
          {onRemove && (
            <button
              type="button"
              className="ml-auto grid size-11 place-items-center text-[var(--c-ink-muted)] hover:text-[var(--c-ink)]"
              onClick={onRemove}
              aria-label="Изтрий реда"
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>
      </form>
    </li>
  )
}

export function TipPicker() {
  const { state, dispatch } = useProto()
  return (
    <div
      className="flex items-center gap-1 py-1"
      role="group"
      aria-label="Бакшиш"
    >
      <span className="mr-1 text-[11px] text-[var(--c-ink-muted)]">Бакшиш</span>
      {TIPS.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={state.bill.tipPercent === t}
          onClick={() => dispatch({ type: 'setTipPercent', percent: t })}
          className={cn(
            'min-h-11 min-w-11 rounded-full px-2 text-[12px]',
            state.bill.tipPercent === t
              ? 'bg-[var(--c-ink)] font-semibold text-[var(--c-paper)]'
              : 'hover:bg-[var(--c-paper-2)]',
          )}
        >
          {t}%
        </button>
      ))}
    </div>
  )
}

/** On-table tray for adding people: recent friends as chips, or a new name. */
export function PeopleTray({ onClose }: { onClose: () => void }) {
  const { derived, dispatch } = useProto()
  const [name, setName] = useState('')
  const present = new Set(derived.seats.map((s) => s.name))
  const recent = RECENT_FRIENDS.filter((n) => !present.has(n))
  const dupe = name.trim() && present.has(name.trim())

  return (
    <div className="rounded-[22px] bg-[var(--c-table-2)] p-3 text-[var(--c-on-table)]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="c-display text-[13px] font-bold">Кой е на масата?</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Затвори"
          className="-mr-1 grid size-11 place-items-center"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      {derived.guests.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {derived.guests.map((g) => (
            <li key={g.participantId}>
              <button
                type="button"
                className="flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--c-table)] py-1 pl-1 pr-3 text-[12px]"
                onClick={() =>
                  dispatch({
                    type: 'removeParticipant',
                    participantId: g.participantId,
                  })
                }
                aria-label={`Махни ${g.name}`}
              >
                <SeatAvatar
                  seat={g}
                  index={seatIndex(derived.seats, g.participantId)}
                  size="sm"
                />
                {g.name}
                <X
                  className="size-3.5 text-[var(--c-on-table-muted)]"
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {recent.length > 0 && (
        <>
          <p className="mb-1 text-[11px] text-[var(--c-on-table-muted)]">
            Делили сте с
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {recent.map((n) => (
              <button
                key={n}
                type="button"
                className="flex min-h-11 items-center gap-1 rounded-full border-[1.5px] border-dashed border-[var(--c-on-table-muted)] px-3 text-[12px] hover:border-solid"
                onClick={() => dispatch({ type: 'addParticipant', name: n })}
              >
                <Plus className="size-3.5" strokeWidth={2} aria-hidden />
                {n}
              </button>
            ))}
          </div>
        </>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim() || dupe) return
          dispatch({ type: 'addParticipant', name })
          setName('')
        }}
      >
        <div className="min-w-0 flex-1">
          <label
            htmlFor="c-new-person"
            className="text-[11px] text-[var(--c-on-table-muted)]"
          >
            Ново име
          </label>
          <input
            id="c-new-person"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="c-input !border-[var(--c-on-table)] !text-[var(--c-on-table)] placeholder:!text-[var(--c-on-table-muted)]"
            placeholder="напр. Владо"
            aria-invalid={!!dupe}
          />
          {dupe && (
            <p className="mt-1 text-[11px] font-semibold">
              {name.trim()} вече е на масата.
            </p>
          )}
        </div>
        <button
          type="submit"
          className="c-ghost"
          disabled={!name.trim() || !!dupe}
        >
          Добави
        </button>
      </form>
    </div>
  )
}
