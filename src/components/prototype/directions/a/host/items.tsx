/**
 * PROTOTYPE — Direction A „Артикули“: the same Claim-group rows guests see,
 * with a bottom sheet for "who had how many" (takeUnit / releaseUnit per
 * seat) and explicit „Сподели бройка“ (setUnitMembers). Receipt scan, manual
 * add/edit, tip and „Раздели остатъка поравно“ live here too.
 */
import { useState } from 'react'
import {
  CameraIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  SplitIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { parseEurInput } from '#/lib/format-currency.ts'
import type {
  ClaimGroup,
  UnitRef,
} from '../../../../../../shared/claim-groups.ts'
import { HOST_ID } from '../../mock/data.ts'
import { formatEur, useProto } from '../../mock/store.tsx'
import {
  ASheet,
  Avatar,
  AvatarStack,
  Btn,
  Chip,
  Confirm,
  Field,
  Group,
  GroupLabel,
  IconBtn,
  Money,
  STROKE,
  Segmented,
  Skel,
  Stepper,
  TextInput,
} from '../ui.tsx'
import { perHeadText } from '../split.ts'

export function ItemsTab({
  booting,
  locked,
  onGoPeople,
}: {
  booting: boolean
  locked: boolean
  onGoPeople: () => void
}) {
  const { derived, state, scanReceipt } = useProto()
  const { bill } = derived
  const [assignKey, setAssignKey] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ itemId: string | null } | null>(null)
  const [splitOpen, setSplitOpen] = useState(false)
  const [reviewDismissed, setReviewDismissed] = useState(false)

  if (booting) return <ItemsSkeleton />
  if (state.scanning) return <ScanningState />

  if (bill.items.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center rounded-[14px] border border-dashed border-(--a-field) px-6 py-10 text-center">
          <ReceiptTextIcon
            strokeWidth={STROKE}
            className="size-8 text-(--a-muted)"
          />
          <p className="mt-3 text-[17px] font-semibold">Още няма артикули</p>
          <p className="mt-1 max-w-[32ch] text-[15px] text-(--a-muted)">
            Снимайте бележката и ние ще извадим редовете. Или ги въведете на
            ръка.
          </p>
          <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
            <Btn size="lg" onClick={scanReceipt}>
              <CameraIcon strokeWidth={STROKE} />
              Снимай бележката
            </Btn>
            <Btn
              size="lg"
              variant="secondary"
              onClick={() => setEditor({ itemId: null })}
            >
              <PencilIcon strokeWidth={STROKE} />
              Въведи ръчно
            </Btn>
          </div>
        </div>
        <ItemEditor editor={editor} onClose={() => setEditor(null)} />
      </>
    )
  }

  const scanned = bill.items.some((i) => i._id.startsWith('i-scan'))
  const assignGroup = derived.groups.find((g) => g.key === assignKey) ?? null

  return (
    <div className="flex flex-col gap-5">
      {scanned && !reviewDismissed && (
        <ScanReview
          onDismiss={() => setReviewDismissed(true)}
          onGoPeople={onGoPeople}
          needsPeople={bill.participants.length < 2}
        />
      )}

      {!locked &&
        derived.unclaimedUnits > 0 &&
        bill.participants.length > 1 && (
          <div className="flex items-center gap-3 rounded-[14px] bg-[color-mix(in_oklch,var(--a-pending-strong)_14%,transparent)] px-4 py-3">
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="font-semibold text-(--a-text)">
                {derived.unclaimedUnits === 1
                  ? '1 бройка без собственик'
                  : `${derived.unclaimedUnits} бройки без собственик`}
              </p>
              <p className="text-(--a-muted)">
                <Money cents={derived.unclaimedCents} /> още не са на никого
              </p>
            </div>
            <Btn
              size="sm"
              variant="secondary"
              className="bg-(--a-surface)"
              onClick={() => setSplitOpen(true)}
            >
              <SplitIcon strokeWidth={STROKE} />
              Раздели
            </Btn>
          </div>
        )}

      <section>
        <GroupLabel
          action={
            !locked && (
              <Btn
                size="sm"
                variant="ghost"
                className="-mr-2"
                onClick={scanReceipt}
              >
                <CameraIcon strokeWidth={STROKE} />
                Снимай още
              </Btn>
            )
          }
        >
          {derived.groups.length === 1
            ? '1 артикул'
            : `${derived.groups.length} артикула`}
        </GroupLabel>
        <Group>
          {derived.groups.map((g) => (
            <HostClaimRow
              key={g.key}
              group={g}
              locked={locked}
              onOpen={() => setAssignKey(g.key)}
            />
          ))}
          {!locked && (
            <button
              type="button"
              onClick={() => setEditor({ itemId: null })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-medium text-(--a-accent) hover:bg-(--a-surface-2)"
            >
              <PlusIcon strokeWidth={STROKE} className="size-[18px]" />
              Добави артикул
            </button>
          )}
        </Group>
      </section>

      <TipRow locked={locked} />

      <AssignSheet
        group={assignGroup}
        onClose={() => setAssignKey(null)}
        onEdit={(itemId) => {
          setAssignKey(null)
          setEditor({ itemId })
        }}
      />
      <ItemEditor editor={editor} onClose={() => setEditor(null)} />
      <SplitRestConfirm open={splitOpen} onOpenChange={setSplitOpen} />
    </div>
  )
}

/* ------------------------------------------------------------- claim row */

function HostClaimRow({
  group,
  locked,
  onOpen,
}: {
  group: ClaimGroup
  locked: boolean
  onOpen: () => void
}) {
  const { derived } = useProto()
  const owners: string[] = []
  let free = 0
  for (const u of group.units) {
    const m = derived.unitMembers(u)
    if (m.length === 0) free += 1
    for (const id of m) owners.push(derived.labels[id] ?? '?')
  }
  const distinct = [...new Set(owners)]
  const qty = group.units.length
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={locked}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--a-surface-2) disabled:hover:bg-transparent"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[15px] font-medium">{group.name}</p>
          <Money
            cents={group.unitPriceCents * qty}
            className="text-[15px] font-semibold"
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {distinct.length > 0 && (
              <AvatarStack
                names={distinct}
                max={4}
                meName={derived.labels[HOST_ID]}
              />
            )}
            <span className="truncate text-[13px] text-(--a-muted)">
              {free === 0
                ? 'разпределено'
                : free === qty
                  ? qty === 1
                    ? 'свободна'
                    : `${qty} свободни`
                  : `${free} от ${qty} свободни`}
            </span>
          </div>
          <span className="shrink-0 text-[13px] text-(--a-muted) tabular-nums">
            {qty > 1 ? `${qty} × ${formatEur(group.unitPriceCents)}` : ''}
          </span>
        </div>
      </div>
      {!locked && (
        <ChevronRightIcon
          strokeWidth={STROKE}
          className="size-4 shrink-0 text-(--a-muted)"
        />
      )}
    </button>
  )
}

/* ---------------------------------------------------------- assign sheet */

function AssignSheet({
  group,
  onClose,
  onEdit,
}: {
  group: ClaimGroup | null
  onClose: () => void
  onEdit: (itemId: string) => void
}) {
  const { derived, dispatch } = useProto()
  const [share, setShare] = useState<{
    unitIndex: number | null
    ids: string[]
  } | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  // Keep the last group while the sheet animates out.
  const [last, setLast] = useState<ClaimGroup | null>(group)
  if (group && group !== last) setLast(group)
  const g = group ?? last

  const open = !!group
  if (!g) return null

  const free = g.units.filter((u) => derived.unitMembers(u).length === 0)
  const shared = g.units
    .map((u, i) => ({ unit: u, i, members: derived.unitMembers(u) }))
    .filter((x) => x.members.length > 1)
  const participants = derived.bill.participants

  function saveShare() {
    if (!share || !g) return
    if (share.ids.length < 2) return setShareError('Изберете поне двама')
    const unit: UnitRef | undefined =
      share.unitIndex === null ? free.at(0) : g.units.at(share.unitIndex)
    if (!unit) return setShareError('Няма свободна бройка')
    dispatch({ type: 'setUnitMembers', unit, participantIds: share.ids })
    setShare(null)
  }

  return (
    <ASheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setShare(null)
          onClose()
        }
      }}
      title={share ? 'Сподели бройка' : g.name}
      description={
        share
          ? `${g.name}, ${share.ids.length > 0 ? perHeadText(g.unitPriceCents, share.ids, participants) : formatEur(g.unitPriceCents)}`
          : `${g.units.length} × ${formatEur(g.unitPriceCents)}, ${free.length === 0 ? 'всичко е разпределено' : free.length === 1 ? '1 свободна' : `${free.length} свободни`}`
      }
      headerAction={
        share ? (
          <IconBtn label="Назад" onClick={() => setShare(null)}>
            <XIcon strokeWidth={STROKE} />
          </IconBtn>
        ) : (
          <Btn size="sm" variant="ghost" onClick={() => onEdit(g.itemIds[0])}>
            <PencilIcon strokeWidth={STROKE} />
            Редактирай
          </Btn>
        )
      }
      footer={
        share ? (
          <Btn size="lg" className="w-full" onClick={saveShare}>
            {share.unitIndex === null ? 'Сподели' : 'Запази'}
          </Btn>
        ) : (
          <div className="flex items-center gap-2">
            <Btn
              size="lg"
              variant="ghost"
              className="px-3"
              disabled={free.length === 0}
              onClick={() => {
                setShareError(null)
                setShare({ unitIndex: null, ids: [] })
              }}
            >
              <UsersIcon strokeWidth={STROKE} />
              Сподели бройка
            </Btn>
            <Btn size="lg" className="flex-1" onClick={onClose}>
              Готово
            </Btn>
          </div>
        )
      }
    >
      {share ? (
        <div>
          <p className="mb-3 text-[15px] text-(--a-muted)">
            Кой я сподели? Сумата се дели между тях.
          </p>
          <div className="flex flex-wrap gap-2">
            {derived.seats.map((s) => {
              const on = share.ids.includes(s.participantId)
              return (
                <Chip
                  key={s.participantId}
                  selected={on}
                  onClick={() => {
                    setShareError(null)
                    setShare({
                      ...share,
                      ids: on
                        ? share.ids.filter((x) => x !== s.participantId)
                        : [...share.ids, s.participantId],
                    })
                  }}
                >
                  {s.name}
                  {s.isHost ? ' (вие)' : ''}
                </Chip>
              )
            })}
          </div>
          {shareError && (
            <p className="mt-3 text-[13px] font-medium text-(--a-danger)">
              {shareError}
            </p>
          )}
          {share.unitIndex !== null && (
            <Btn
              variant="danger"
              size="sm"
              className="mt-4 -ml-3"
              onClick={() => {
                dispatch({
                  type: 'setUnitMembers',
                  unit: g.units[share.unitIndex as number],
                  participantIds: [],
                })
                setShare(null)
              }}
            >
              <Trash2Icon strokeWidth={STROKE} />
              Освободи бройката
            </Btn>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="-mx-1">
            {derived.seats.map((s) => {
              const view = derived.seatView(g.key, s.participantId)
              const solo = view.mySoloUnits.length
              const sharedCount = view.mySharedUnits.length
              return (
                <div
                  key={s.participantId}
                  className="flex items-center gap-3 rounded-[10px] px-1 py-2"
                >
                  <Avatar name={s.name} me={s.isHost} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">
                      {s.name}
                      {s.isHost && (
                        <span className="font-normal text-(--a-muted)">
                          {' '}
                          (вие)
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] text-(--a-muted)">
                      {view.myShareCents > 0 ? (
                        <Money cents={view.myShareCents} />
                      ) : (
                        'нищо'
                      )}
                      {sharedCount > 0 &&
                        `, ${sharedCount === 1 ? '1 споделена' : `${sharedCount} споделени`}`}
                    </p>
                  </div>
                  <Stepper
                    value={solo}
                    label={`${g.name} за ${s.name}`}
                    onDec={() =>
                      dispatch({
                        type: 'releaseUnit',
                        groupKey: g.key,
                        participantId: s.participantId,
                      })
                    }
                    onInc={() =>
                      dispatch({
                        type: 'takeUnit',
                        groupKey: g.key,
                        participantId: s.participantId,
                      })
                    }
                    incDisabled={free.length === 0}
                  />
                </div>
              )
            })}
          </div>

          {shared.length > 0 && (
            <section>
              <GroupLabel>Споделени бройки</GroupLabel>
              <Group>
                {shared.map(({ unit, i, members }) => (
                  <button
                    key={`${unit.itemId}-${unit.unitIndex}`}
                    type="button"
                    onClick={() => {
                      setShareError(null)
                      setShare({ unitIndex: i, ids: members })
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-(--a-surface-2)"
                  >
                    <AvatarStack
                      names={members.map((m) => derived.labels[m] ?? '?')}
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px]">
                      {members.map((m) => derived.labels[m]).join(', ')}
                    </span>
                    <span className="text-[13px] text-(--a-muted) tabular-nums">
                      {perHeadText(g.unitPriceCents, members, participants)}
                    </span>
                    <ChevronRightIcon
                      strokeWidth={STROKE}
                      className="size-4 text-(--a-muted)"
                    />
                  </button>
                ))}
              </Group>
            </section>
          )}
        </div>
      )}
    </ASheet>
  )
}

/* ----------------------------------------------------------- item editor */

const PRICE_RE = /^\d{1,5}([.,]\d{1,2})?$/

function ItemEditor({
  editor,
  onClose,
}: {
  editor: { itemId: string | null } | null
  onClose: () => void
}) {
  const { state, dispatch } = useProto()
  const existing = editor?.itemId
    ? state.bill.items.find((i) => i._id === editor.itemId)
    : undefined
  const [seed, setSeed] = useState<typeof editor>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [qty, setQty] = useState(1)
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({})

  // Reset the form when a new editor session opens.
  if (editor !== seed) {
    setSeed(editor)
    if (editor) {
      setName(existing?.name ?? '')
      setPrice(
        existing
          ? (existing.unitPriceCents / 100).toFixed(2).replace('.', ',')
          : '',
      )
      setQty(existing?.quantity ?? 1)
      setErrors({})
    }
  }

  function save() {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Въведете име на артикула'
    const p = price.trim()
    if (!p) next.price = 'Въведете цена'
    else if (!PRICE_RE.test(p))
      next.price = 'Цената трябва да е число, например 4,50'
    else if (parseEurInput(p) <= 0) next.price = 'Цената трябва да е над 0'
    setErrors(next)
    if (next.name || next.price) return
    const item = {
      name: name.trim(),
      unitPriceCents: parseEurInput(p),
      quantity: qty,
    }
    if (existing)
      dispatch({ type: 'updateItem', itemId: existing._id, patch: item })
    else dispatch({ type: 'addItem', item })
    onClose()
  }

  const priceCents = PRICE_RE.test(price.trim()) ? parseEurInput(price) : 0

  return (
    <ASheet
      open={!!editor}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? 'Редактирай артикул' : 'Нов артикул'}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Btn
              size="lg"
              variant="danger"
              aria-label="Изтрий артикула"
              onClick={() => {
                dispatch({ type: 'removeItem', itemId: existing._id })
                onClose()
              }}
            >
              <Trash2Icon strokeWidth={STROKE} />
            </Btn>
          )}
          <Btn size="lg" className="flex-1" onClick={save}>
            {existing ? 'Запази' : 'Добави'}
          </Btn>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label="Име" htmlFor="a-item-name" error={errors.name}>
          <TextInput
            id="a-item-name"
            value={name}
            invalid={!!errors.name}
            placeholder="Шопска салата"
            autoComplete="off"
            onChange={(e) => {
              setName(e.target.value)
              setErrors((x) => ({ ...x, name: undefined }))
            }}
          />
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-start gap-4">
          <Field
            label="Цена за бройка, €"
            htmlFor="a-item-price"
            error={errors.price}
          >
            <TextInput
              id="a-item-price"
              inputMode="decimal"
              value={price}
              invalid={!!errors.price}
              placeholder="0,00"
              className="tabular-nums"
              onChange={(e) => {
                setPrice(e.target.value)
                setErrors((x) => ({ ...x, price: undefined }))
              }}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-(--a-muted)">
              Брой
            </span>
            <div className="flex h-11 items-center">
              <Stepper
                value={qty}
                label="Брой"
                onDec={() => setQty((q) => Math.max(1, q - 1))}
                onInc={() => setQty((q) => Math.min(99, q + 1))}
                decDisabled={qty <= 1}
              />
            </div>
          </div>
        </div>
        {qty > 1 && priceCents > 0 && (
          <p className="text-[13px] text-(--a-muted)">
            Ред общо{' '}
            <Money
              cents={priceCents * qty}
              className="font-semibold text-(--a-text)"
            />
          </p>
        )}
        <button type="submit" className="sr-only">
          Запази
        </button>
      </form>
    </ASheet>
  )
}

/* ------------------------------------------------------------ split rest */

export function SplitRestConfirm({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { derived, dispatch } = useProto()
  const n = derived.bill.participants.length
  return (
    <Confirm
      open={open}
      onOpenChange={onOpenChange}
      title="Раздели остатъка поравно?"
      description={
        <>
          {derived.unclaimedUnits === 1
            ? '1 свободна бройка'
            : `${derived.unclaimedUnits} свободни бройки`}{' '}
          за{' '}
          <Money
            cents={derived.unclaimedCents}
            className="font-semibold text-(--a-text)"
          />{' '}
          ще се разделят между всички {n} души, по около{' '}
          <Money
            cents={Math.round(derived.unclaimedCents / Math.max(1, n))}
            className="font-semibold text-(--a-text)"
          />
          .
        </>
      }
      confirmLabel="Раздели"
      onConfirm={() => dispatch({ type: 'splitRestEvenly' })}
    />
  )
}

/* ------------------------------------------------------------------- tip */

function TipRow({ locked }: { locked: boolean }) {
  const { derived, dispatch } = useProto()
  const pct = String(derived.bill.tipPercent) as '0' | '5' | '10' | '15'
  return (
    <Group>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[15px] font-medium">Бакшиш</p>
          <p className="text-[13px] text-(--a-muted)">
            <Money cents={derived.tipCents} />, дели се поравно между всички
          </p>
        </div>
        {locked ? (
          <span className="text-[15px] font-semibold tabular-nums">
            {pct} %
          </span>
        ) : (
          <Segmented
            value={pct}
            onChange={(v) =>
              dispatch({ type: 'setTipPercent', percent: Number(v) })
            }
            options={['0', '5', '10', '15'].map((v) => ({
              value: v as typeof pct,
              label: `${v} %`,
            }))}
          />
        )}
      </div>
    </Group>
  )
}

/* ---------------------------------------------------------- scan states */

function ScanReview({
  onDismiss,
  onGoPeople,
  needsPeople,
}: {
  onDismiss: () => void
  onGoPeople: () => void
  needsPeople: boolean
}) {
  const { state, derived } = useProto()
  const scannedCount = state.bill.items.filter((i) =>
    i._id.startsWith('i-scan'),
  ).length
  return (
    <div className="flex gap-3 rounded-[14px] border border-(--a-hairline) bg-(--a-surface) p-3">
      <div
        aria-label="Снимка на бележката"
        className="flex h-[76px] w-[56px] shrink-0 flex-col items-center justify-center gap-1 rounded-[8px] bg-(--a-surface-2) text-(--a-muted)"
      >
        <ReceiptTextIcon strokeWidth={STROKE} className="size-5" />
        <span className="text-[11px]">Снимка</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold">
            <CheckCircle2Icon
              strokeWidth={STROKE}
              className="size-4 text-(--a-paid)"
            />
            Разпознахме {scannedCount} реда
          </p>
          <IconBtn
            label="Скрий"
            className="-mt-1.5 -mr-1.5 size-8"
            onClick={onDismiss}
          >
            <XIcon strokeWidth={STROKE} />
          </IconBtn>
        </div>
        <p className="mt-0.5 text-[13px] text-(--a-muted)">
          Сборът на редовете{' '}
          <Money
            cents={derived.subtotalCents}
            className="font-semibold text-(--a-text)"
          />{' '}
          съвпада с бележката. Докоснете ред, за да поправите цена.
        </p>
        {needsPeople && (
          <Btn
            size="sm"
            variant="ghost"
            className="mt-1 -ml-3"
            onClick={onGoPeople}
          >
            Следва: добавете хората
            <ChevronRightIcon strokeWidth={STROKE} />
          </Btn>
        )}
      </div>
    </div>
  )
}

function ScanningState() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mb-4 flex items-center gap-3 rounded-[14px] border border-(--a-hairline) bg-(--a-surface) p-3">
        <div className="flex h-[76px] w-[56px] shrink-0 items-center justify-center rounded-[8px] bg-(--a-surface-2)">
          <ReceiptTextIcon
            strokeWidth={STROKE}
            className="size-5 text-(--a-muted) motion-safe:animate-pulse"
          />
        </div>
        <div>
          <p className="text-[15px] font-semibold">Четем бележката</p>
          <p className="text-[13px] text-(--a-muted)">
            Отнема няколко секунди.
          </p>
        </div>
      </div>
      <ItemsSkeleton />
    </div>
  )
}

function ItemsSkeleton() {
  return (
    <Group>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-4 py-3.5">
          <div className="flex justify-between">
            <Skel className={cn('h-4', i % 2 ? 'w-32' : 'w-44')} />
            <Skel className="h-4 w-14" />
          </div>
          <Skel className="mt-2.5 h-3 w-24" />
        </div>
      ))}
    </Group>
  )
}
