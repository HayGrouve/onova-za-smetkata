import { useMutation } from 'convex/react'
import { CheckCircle2Icon, SearchIcon, UsersIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ItemAssignSheet } from '#/components/bills/item-assign-sheet.tsx'
import { ItemEditSheet } from '#/components/bills/item-edit-sheet.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { buildParticipantInitials } from '#/lib/participant-initials.ts'
import { cn } from '#/lib/utils.ts'
import {
  countCoveredUnits,
  itemHasEmptyUnit,
} from '../../../shared/unit-coverage'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

type ItemFilter = 'unassigned' | 'all'

/** Show a search field once the list no longer fits on a phone screen. */
const SEARCH_MIN_ITEMS = 9

export interface ItemListProps {
  billId: Id<'bills'>
  items: Doc<'items'>[]
  participants: Doc<'participants'>[]
  assignments: Doc<'itemAssignments'>[]
  labels: Record<string, string>
  readOnly?: boolean
  onAddItems: () => void
  /** Offered once every Unit is assigned (e.g. go to Плащания). */
  onAllAssigned?: () => void
}

/**
 * Step 3 · Разпределение: one compact row per item line; tapping a row opens
 * the assignment sheet. Items are entered on step 1.
 */
export function ItemList({
  billId,
  items,
  participants,
  assignments,
  labels,
  readOnly = false,
  onAddItems,
  onAllAssigned,
}: ItemListProps) {
  const assignAll = useMutation(api.assignments.assignAll)
  const [openItemId, setOpenItemId] = useState<Id<'items'> | null>(null)
  // Last opened item stays mounted so sheets keep their content while closing.
  const [lastOpenItemId, setLastOpenItemId] = useState<Id<'items'> | null>(null)
  const [editing, setEditing] = useState<Doc<'items'> | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [search, setSearch] = useState('')

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  )

  const assignmentsByItem = useMemo(() => {
    const map = new Map<string, Doc<'itemAssignments'>[]>()
    for (const assignment of assignments) {
      const list = map.get(assignment.itemId) ?? []
      list.push(assignment)
      map.set(assignment.itemId, list)
    }
    return map
  }, [assignments])

  const initials = useMemo(() => buildParticipantInitials(labels), [labels])

  function itemInput(item: Doc<'items'>) {
    return {
      id: item._id,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    }
  }

  const unassignedIds = new Set(
    sorted
      .filter((item) =>
        itemHasEmptyUnit(
          itemInput(item),
          assignmentsByItem.get(item._id) ?? [],
        ),
      )
      .map((item) => item._id),
  )
  const totalUnits = sorted.reduce((sum, item) => sum + item.quantity, 0)
  const coveredUnits = sorted.reduce(
    (sum, item) =>
      sum +
      countCoveredUnits(itemInput(item), assignmentsByItem.get(item._id) ?? []),
    0,
  )

  // Start on the gaps when there are any. Chosen once, so assigning the last
  // Unit lands on „Всичко е разпределено“ instead of jumping to „Всички“.
  const [filter, setFilter] = useState<ItemFilter>(() =>
    unassignedIds.size > 0 ? 'unassigned' : 'all',
  )
  const showSearch = sorted.length >= SEARCH_MIN_ITEMS
  const query = showSearch ? search.trim().toLocaleLowerCase('bg') : ''
  const visible = sorted.filter(
    (item) =>
      (filter === 'all' || unassignedIds.has(item._id)) &&
      (!query || item.name.toLocaleLowerCase('bg').includes(query)),
  )

  const openItem = lastOpenItemId
    ? sorted.find((item) => item._id === lastOpenItemId)
    : undefined

  function openAssignSheet(itemId: Id<'items'> | null) {
    setOpenItemId(itemId)
    if (itemId) setLastOpenItemId(itemId)
  }
  const remainingUnassigned = [...unassignedIds].filter(
    (id) => id !== openItemId,
  ).length

  function openNextUnassigned() {
    const startIndex = sorted.findIndex((item) => item._id === openItemId)
    const ordered = [
      ...sorted.slice(startIndex + 1),
      ...sorted.slice(0, Math.max(startIndex, 0)),
    ]
    const next = ordered.find((item) => unassignedIds.has(item._id))
    openAssignSheet(next?._id ?? null)
  }

  async function handleAssignAllUnassigned() {
    try {
      await assignAll({ billId, mode: 'unassigned_only' })
      toast.success('Неразпределените артикули са разделени поравно')
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">Все още няма артикули.</p>
        {!readOnly ? (
          <Button variant="outline" className="h-11" onClick={onAddItems}>
            Към стъпка 1 · Добави артикули
          </Button>
        ) : null}
      </div>
    )
  }

  const progress = totalUnits > 0 ? coveredUnits / totalUnits : 0
  const allAssigned = unassignedIds.size === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">
            Разпределени {coveredUnits} от {totalUnits} бройки
          </span>
          {allAssigned ? (
            <span className="text-xs font-medium text-success">Готово</span>
          ) : null}
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Разпределени бройки"
          aria-valuemin={0}
          aria-valuemax={totalUnits}
          aria-valuenow={coveredUnits}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
              allAssigned ? 'bg-success' : 'bg-primary',
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {!allAssigned && participants.length > 0 && !readOnly ? (
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => void handleAssignAllUnassigned()}
        >
          <UsersIcon className={ICON.button} aria-hidden />
          Раздели поравно неразпределените
        </Button>
      ) : null}

      <div
        className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1"
        role="tablist"
        aria-label="Филтър на артикули"
      >
        {(
          [
            ['unassigned', `Неразпределени (${unassignedIds.size})`],
            ['all', `Всички (${sorted.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              'h-10 rounded-md text-sm font-medium transition-colors',
              filter === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {showSearch ? (
        <div className="relative">
          <Label htmlFor="assign-item-search" className="sr-only">
            Търсене по артикул
          </Label>
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="assign-item-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Търсене по артикул"
            className="h-11 pl-9"
          />
        </div>
      ) : null}

      {visible.length === 0 ? (
        filter === 'unassigned' && !query ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center">
            <CheckCircle2Icon className="size-6 text-success" aria-hidden />
            <p className="text-sm font-medium">Всичко е разпределено</p>
            {onAllAssigned ? (
              <Button className="mt-1 h-11" onClick={onAllAssigned}>
                Към плащанията
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Няма артикули, които отговарят на търсенето.
          </p>
        )
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visible.map((item) => (
            <li key={item._id}>
              <ItemRow
                item={item}
                itemAssignments={assignmentsByItem.get(item._id) ?? []}
                labels={labels}
                initials={initials}
                participantCount={participants.length}
                hasGap={unassignedIds.has(item._id)}
                onOpen={() => openAssignSheet(item._id)}
              />
            </li>
          ))}
        </ul>
      )}

      <ItemAssignSheet
        open={openItemId !== null}
        item={openItem}
        onOpenChange={(open) => {
          if (!open) setOpenItemId(null)
        }}
        participants={participants}
        labels={labels}
        itemAssignments={
          openItem ? (assignmentsByItem.get(openItem._id) ?? []) : []
        }
        readOnly={readOnly}
        remainingUnassigned={remainingUnassigned}
        onNextUnassigned={openNextUnassigned}
        onEditItem={() => {
          if (!openItem) return
          setOpenItemId(null)
          setEditing(openItem)
          setEditOpen(true)
        }}
      />

      <ItemEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        billId={billId}
        item={editing ?? undefined}
      />
    </div>
  )
}

function ItemRow({
  item,
  itemAssignments,
  labels,
  initials,
  participantCount,
  hasGap,
  onOpen,
}: {
  item: Doc<'items'>
  itemAssignments: Doc<'itemAssignments'>[]
  labels: Record<string, string>
  initials: Record<string, string>
  participantCount: number
  hasGap: boolean
  onOpen: () => void
}) {
  const assigneeIds = [
    ...new Set(itemAssignments.map((assignment) => assignment.participantId)),
  ]
  const covered = countCoveredUnits(
    {
      id: item._id,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    },
    itemAssignments,
  )
  const everyone =
    !hasGap && participantCount > 1 && assigneeIds.length === participantCount
  const assigneeNames = assigneeIds.map((id) => labels[id] ?? '').join(', ')
  const status =
    assigneeIds.length === 0
      ? 'неразпределен'
      : everyone
        ? 'всички'
        : assigneeNames

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Разпредели ${item.name}, ${status}`}
      className={cn(
        'tap-feedback flex w-full items-center gap-3 border-l-4 px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
        hasGap ? 'border-accent-foreground' : 'border-transparent',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="money">
            {formatEur(item.unitPriceCents)}
            {item.quantity > 1 ? ` × ${item.quantity}` : ''}
          </span>
          {item.quantity > 1 ? (
            <span className={cn(hasGap && 'text-accent-foreground')}>
              {' '}
              · {covered}/{item.quantity} бр.
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="money text-sm font-semibold">
          {formatEur(item.unitPriceCents * item.quantity)}
        </span>
        {assigneeIds.length === 0 ? (
          <span className="text-[11px] font-medium text-accent-foreground">
            Неразпределен
          </span>
        ) : everyone ? (
          <span className="text-[11px] text-muted-foreground">Всички</span>
        ) : (
          <span className="flex -space-x-1.5" aria-hidden>
            {assigneeIds.slice(0, 4).map((id) => (
              <span
                key={id}
                className="grid size-6 place-items-center rounded-full border-2 border-card bg-primary/20 text-[9px] font-semibold text-foreground"
              >
                {initials[id] ?? '?'}
              </span>
            ))}
            {assigneeIds.length > 4 ? (
              <span className="grid size-6 place-items-center rounded-full border-2 border-card bg-muted text-[9px] font-semibold">
                +{assigneeIds.length - 4}
              </span>
            ) : null}
          </span>
        )}
      </div>
    </button>
  )
}
