/**
 * PROTOTYPE — Direction A bill workspace: sticky summary (Общо, Остават,
 * claimed progress) + segmented tabs. Any tab is reachable at any time.
 */
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ChevronLeftIcon,
  LockIcon,
  LockOpenIcon,
  PencilIcon,
  RadioIcon,
  SplitIcon,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { useProto } from '../../mock/store.tsx'
import {
  ASheet,
  Btn,
  Field,
  IconBtn,
  Meter,
  Money,
  Pill,
  RowMenu,
  STROKE,
  Skel,
  Tabs,
  TextInput,
  relTime,
} from '../ui.tsx'
import { ItemsTab, SplitRestConfirm } from './items.tsx'
import { PeopleTab } from './people.tsx'
import { PaymentsPanel } from './payments.tsx'
import { statusPill } from './shared.tsx'

export type BillTab = 'items' | 'people' | 'payments'

export function Workspace({
  pane,
  booting,
  tab,
  setTab,
  showPaymentsTab,
  onBack,
}: {
  pane: boolean
  booting: boolean
  tab: BillTab
  setTab: (t: BillTab) => void
  showPaymentsTab: boolean
  onBack: () => void
}) {
  const { derived, state, dispatch } = useProto()
  const { bill } = derived
  const reduce = useReducedMotion()
  const [renameOpen, setRenameOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const locked = bill.status === 'final'
  const status = locked
    ? 'final'
    : derived.guests.some((g) => g.joined)
      ? 'collecting'
      : 'draft'
  const pill = statusPill(status)
  const latest = state.activity[0] as
    (typeof state.activity)[number] | undefined
  const hasLive = derived.guests.some((g) => g.joined) && !locked

  const tabs: Array<{ value: BillTab; label: string; badge?: number }> = [
    { value: 'items', label: 'Артикули' },
    { value: 'people', label: 'Хора' },
  ]
  if (showPaymentsTab)
    tabs.push({
      value: 'payments',
      label: 'Плащания',
      badge: bill.pending.length || undefined,
    })

  return (
    <div
      className={cn('mx-auto w-full pb-24', pane ? 'max-w-3xl' : 'max-w-xl')}
    >
      {/* Sticky chrome: top bar, summary, tabs */}
      <div className="sticky top-0 z-20 bg-(--a-bg)">
        <div className="flex h-14 items-center gap-1 px-2">
          {!pane && (
            <IconBtn label="Назад към сметките" onClick={onBack}>
              <ChevronLeftIcon strokeWidth={STROKE} />
            </IconBtn>
          )}
          <button
            type="button"
            disabled={locked}
            onClick={() => setRenameOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2 py-1 text-left hover:bg-(--a-surface-2) disabled:hover:bg-transparent"
          >
            <h1 className="truncate text-[17px] font-semibold tracking-[-0.01em]">
              {bill.restaurantName || 'Нова сметка'}
            </h1>
            {!locked && (
              <PencilIcon
                strokeWidth={STROKE}
                className="size-3.5 shrink-0 text-(--a-muted)"
              />
            )}
          </button>
          <Pill tone={pill.tone}>
            {locked && <LockIcon className="size-3" strokeWidth={2} />}
            {pill.label}
          </Pill>
          <RowMenu
            label="Още за сметката"
            items={
              locked
                ? [
                    {
                      label: 'Отключи сметката',
                      icon: <LockOpenIcon strokeWidth={STROKE} />,
                      onSelect: () => dispatch({ type: 'reopen' }),
                    },
                  ]
                : [
                    {
                      label: 'Преименувай',
                      icon: <PencilIcon strokeWidth={STROKE} />,
                      onSelect: () => setRenameOpen(true),
                    },
                    {
                      label: 'Раздели остатъка поравно',
                      icon: <SplitIcon strokeWidth={STROKE} />,
                      disabled: derived.unclaimedUnits === 0,
                      onSelect: () => setSplitOpen(true),
                    },
                  ]
            }
          />
        </div>

        <div className="px-4 pb-3">
          {booting ? (
            <div className="flex gap-6 py-1">
              <Skel className="h-10 w-24" />
              <Skel className="h-10 w-24" />
            </div>
          ) : (
            <div className="flex items-end gap-6">
              <div>
                <p className="text-[13px] text-(--a-muted)">Общо</p>
                <p className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">
                  <Money cents={derived.totals.billTotalCents} />
                </p>
              </div>
              <div>
                <p className="text-[13px] text-(--a-muted)">Остават</p>
                <p className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">
                  <Money cents={derived.outstandingCents} />
                </p>
              </div>
              {derived.collectedCents > 0 && (
                <div className="hidden sm:block">
                  <p className="text-[13px] text-(--a-muted)">Събрани</p>
                  <p className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-(--a-paid)">
                    <Money cents={derived.collectedCents} />
                  </p>
                </div>
              )}
            </div>
          )}
          {derived.totalUnits > 0 && (
            <div className="mt-3">
              <Meter value={derived.claimedUnits} max={derived.totalUnits} />
              <p className="mt-1.5 text-[13px] text-(--a-muted) tabular-nums">
                {derived.claimedUnits} от {derived.totalUnits} бройки са
                разпределени
              </p>
              {hasLive && latest && (
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={latest.id}
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0 }}
                    className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-(--a-muted)"
                    aria-live="polite"
                  >
                    <RadioIcon
                      strokeWidth={STROKE}
                      className="size-3.5 shrink-0 text-(--a-accent)"
                    />
                    <span className="truncate text-(--a-text)">
                      {latest.text}
                    </span>
                    <span className="shrink-0">{relTime(latest.at)}</span>
                  </motion.p>
                </AnimatePresence>
              )}
            </div>
          )}
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          options={tabs}
          layoutId="a-bill-tab"
        />
      </div>

      {locked && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-[14px] bg-(--a-surface-2) px-4 py-3 text-[13px] text-(--a-muted)">
          <LockIcon strokeWidth={STROKE} className="size-4 shrink-0" />
          <span className="flex-1">
            Сметката е приключена. Промените са заключени.
          </span>
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => dispatch({ type: 'reopen' })}
          >
            Отключи
          </Btn>
        </div>
      )}

      <div className="px-4 pt-4">
        {tab === 'items' && (
          <ItemsTab
            booting={booting}
            locked={locked}
            onGoPeople={() => setTab('people')}
          />
        )}
        {tab === 'people' && <PeopleTab locked={locked} />}
        {tab === 'payments' && (
          <PaymentsPanel onGoItems={() => setTab('items')} />
        )}
      </div>

      <RenameSheet open={renameOpen} onOpenChange={setRenameOpen} />
      <SplitRestConfirm open={splitOpen} onOpenChange={setSplitOpen} />
    </div>
  )
}

function RenameSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { state, dispatch } = useProto()
  const [name, setName] = useState(state.bill.restaurantName)
  const [error, setError] = useState<string | null>(null)
  function save() {
    if (!name.trim()) return setError('Въведете име на заведението')
    dispatch({ type: 'setRestaurant', name: name.trim() })
    onOpenChange(false)
  }
  return (
    <ASheet
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setName(state.bill.restaurantName)
          setError(null)
        }
        onOpenChange(o)
      }}
      title="Заведение"
      footer={
        <Btn size="lg" className="w-full" onClick={save}>
          Запази
        </Btn>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Име" htmlFor="a-rest-name" error={error}>
          <TextInput
            id="a-rest-name"
            value={name}
            invalid={!!error}
            placeholder="Механа Чучура"
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
        </Field>
      </form>
    </ASheet>
  )
}
