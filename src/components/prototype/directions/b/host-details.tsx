/**
 * PROTOTYPE - Direction B „Детайли“ drawer: the full receipt, tip, editing
 * items, adding people, the link. Everything the focus screen leaves out.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckIcon, CopyIcon, PlusIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { useProto } from '../mock/store.tsx'
import { billLink } from './focus.ts'
import { ItemEditor } from './host-new.tsx'
import { BSheet, Btn, Eur, STROKE, useCopy } from './ui.tsx'

const TIPS = [0, 5, 10, 15]

export function DetailsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { derived, dispatch } = useProto()
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, copy] = useCopy()
  const final = derived.bill.status === 'final'

  const addPerson = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('Напишете име.')
    if (derived.seats.some((s) => s.name.toLowerCase() === n.toLowerCase())) {
      return setError(`${n} вече е на масата.`)
    }
    dispatch({ type: 'addParticipant', name: n })
    setName('')
    setError(null)
  }

  return (
    <BSheet open={open} onOpenChange={onOpenChange} title="Детайли" tall>
      {final && (
        <p className="mb-6 rounded-[20px] bg-(--b-fill) px-5 py-4 text-[16px] text-(--b-muted)">
          Сметката е приключена, затова само се чете.
        </p>
      )}

      <h3 className="text-[17px] font-semibold">Бележката</h3>
      <ul className="-mx-3 mt-2">
        {derived.bill.items.map((item) =>
          editing === item._id ? (
            <li key={item._id}>
              <ItemEditor
                item={item}
                onDone={() => setEditing(null)}
                onRemove={() => {
                  dispatch({ type: 'removeItem', itemId: item._id })
                  setEditing(null)
                }}
              />
            </li>
          ) : (
            <li key={item._id}>
              <button
                type="button"
                disabled={final}
                onClick={() => setEditing(item._id)}
                className="flex w-full cursor-pointer items-baseline gap-3 rounded-[16px] px-3 py-2.5 text-left hover:bg-(--b-fill) disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="b-num w-7 text-[15px] text-(--b-muted)">
                  {item.quantity}×
                </span>
                <span className="min-w-0 flex-1 text-[17px]">{item.name}</span>
                <Eur
                  cents={item.unitPriceCents * item.quantity}
                  className="text-[17px]"
                />
              </button>
            </li>
          ),
        )}
        {editing === 'new' && (
          <li>
            <ItemEditor onDone={() => setEditing(null)} />
          </li>
        )}
      </ul>
      {!final && editing !== 'new' && (
        <Btn
          variant="quiet"
          className="-ml-3"
          onClick={() => setEditing('new')}
        >
          <PlusIcon className="size-5" strokeWidth={STROKE} />
          Добави ред
        </Btn>
      )}

      <div className="mt-4 space-y-1.5 text-[16px]">
        <div className="flex justify-between text-(--b-muted)">
          <span>Сума на редовете</span>
          <Eur cents={derived.subtotalCents} />
        </div>
        <div className="flex justify-between text-(--b-muted)">
          <span>Бакшиш {derived.bill.tipPercent}%</span>
          <Eur cents={derived.tipCents} />
        </div>
        <div className="flex justify-between text-[19px] font-semibold">
          <span>Общо</span>
          <Eur cents={derived.totals.billTotalCents} />
        </div>
      </div>

      <h3 className="mt-10 text-[17px] font-semibold">Бакшиш</h3>
      <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Бакшиш">
        {TIPS.map((t) => {
          const on = derived.bill.tipPercent === t
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={final}
              onClick={() => dispatch({ type: 'setTipPercent', percent: t })}
              className={cn(
                'b-num h-12 flex-1 cursor-pointer rounded-full text-[17px] font-semibold transition-colors disabled:cursor-default',
                on
                  ? 'bg-(--b-text) text-(--b-bg)'
                  : 'bg-(--b-fill) text-(--b-text)',
              )}
            >
              {t === 0 ? 'Без' : `${t}%`}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[15px] text-(--b-muted)">
        Бакшишът се дели според това кой какво е имал.
      </p>

      <h3 className="mt-10 text-[17px] font-semibold">Хората</h3>
      <p className="mt-1 text-[16px] text-(--b-muted)">
        {derived.seats.map((s) => s.name).join(', ')}
      </p>
      {!final && (
        <form onSubmit={addPerson} className="mt-4" noValidate>
          <label
            htmlFor="b-add-person"
            className="mb-1.5 block pl-1 text-[15px] text-(--b-muted)"
          >
            Добави човек
          </label>
          <div className="flex gap-2">
            <input
              id="b-add-person"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              placeholder="Име"
              className="h-12 min-w-0 flex-1 rounded-full bg-(--b-fill) px-5 text-[17px] outline-none focus:ring-2 focus:ring-(--b-accent)"
            />
            <Btn
              type="submit"
              variant="secondary"
              className="h-12 w-auto px-5 text-[16px]"
            >
              Добави
            </Btn>
          </div>
          {error && (
            <p className="mt-2 pl-1 text-[15px] text-(--b-warn)" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      <h3 className="mt-10 text-[17px] font-semibold">Линкът</h3>
      <button
        type="button"
        onClick={() => copy('link', `https://${billLink(derived)}`)}
        className="mt-2 flex h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-full bg-(--b-fill) px-5 text-left text-[16px]"
      >
        <span className="truncate">{billLink(derived)}</span>
        {copied === 'link' ? (
          <span className="flex items-center gap-1.5 text-(--b-accent)">
            <CheckIcon className="size-4" strokeWidth={2.25} />
            Копиран
          </span>
        ) : (
          <CopyIcon className="size-4 text-(--b-muted)" strokeWidth={STROKE} />
        )}
      </button>
    </BSheet>
  )
}
