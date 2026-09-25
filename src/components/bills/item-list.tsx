import { useMutation } from 'convex/react'
import { AlertTriangleIcon, PencilIcon, UsersIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AssignmentRow } from '#/components/bills/assignment-row.tsx'
import { ItemEditSheet } from '#/components/bills/item-edit-sheet.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { cn } from '#/lib/utils.ts'
import {
  countCoveredUnits,
  itemHasEmptyUnit,
} from '../../../shared/unit-coverage'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface ItemListProps {
  billId: Id<'bills'>
  items: Doc<'items'>[]
  participants: Doc<'participants'>[]
  assignments: Doc<'itemAssignments'>[]
  labels: Record<string, string>
  readOnly?: boolean
  onAddItems: () => void
}

/** Step 3 · Разпределение: who had each item. Items are entered on step 1. */
export function ItemList({
  billId,
  items,
  participants,
  assignments,
  labels,
  readOnly = false,
  onAddItems,
}: ItemListProps) {
  const assignAll = useMutation(api.assignments.assignAll)
  const [editing, setEditing] = useState<Doc<'items'> | null>(null)

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

  function itemInput(item: Doc<'items'>) {
    return {
      id: item._id,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    }
  }

  const unassignedItems = sorted.filter((item) =>
    itemHasEmptyUnit(itemInput(item), assignmentsByItem.get(item._id) ?? []),
  )
  const totalUnits = sorted.reduce((sum, item) => sum + item.quantity, 0)
  const coveredUnits = sorted.reduce(
    (sum, item) =>
      sum +
      countCoveredUnits(itemInput(item), assignmentsByItem.get(item._id) ?? []),
    0,
  )
  const firstUnassignedId = unassignedItems[0]?._id

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Разпределени: {coveredUnits} от {totalUnits} бройки
          </span>
          {unassignedItems.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById('first-unassigned-item')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            >
              <Badge variant="destructive" className="gap-1">
                <AlertTriangleIcon className="size-3" aria-hidden />
                {unassignedItems.length} неразпределени
              </Badge>
            </button>
          ) : (
            <span className="font-medium text-success">Готово</span>
          )}
        </div>
        {unassignedItems.length > 0 && participants.length > 0 && !readOnly ? (
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
      </div>

      {sorted.map((item) => {
        const itemAssignments = assignmentsByItem.get(item._id) ?? []
        const isUnassigned = unassignedItems.includes(item)
        return (
          <div
            key={item._id}
            id={
              item._id === firstUnassignedId
                ? 'first-unassigned-item'
                : undefined
            }
            className={cn(
              'flex flex-col gap-3 rounded-lg border p-4',
              isUnassigned && 'border-l-4 border-accent-foreground',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatEur(item.unitPriceCents)} × {item.quantity} ={' '}
                  <span className="money">
                    {formatEur(item.unitPriceCents * item.quantity)}
                  </span>
                </p>
              </div>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 text-muted-foreground"
                  aria-label={`Редактирай ${item.name}`}
                  onClick={() => setEditing(item)}
                >
                  <PencilIcon className="size-4" />
                </Button>
              ) : null}
            </div>
            <AssignmentRow
              itemId={item._id}
              itemName={item.name}
              itemQuantity={item.quantity}
              itemUnitPriceCents={item.unitPriceCents}
              participants={participants}
              labels={labels}
              itemAssignments={itemAssignments}
              readOnly={readOnly}
            />
          </div>
        )
      })}

      <ItemEditSheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        billId={billId}
        item={editing ?? undefined}
      />
    </div>
  )
}
