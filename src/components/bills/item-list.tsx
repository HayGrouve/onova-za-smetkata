import { useMutation } from 'convex/react'
import { AlertTriangleIcon, PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AssignmentRow } from '#/components/bills/assignment-row.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { useDebouncedCallback } from '#/hooks/use-debounced-callback.ts'
import { parseEurInput } from '#/lib/format-currency.ts'
import { ICON } from '#/lib/app-icons.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { cn } from '#/lib/utils.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface ItemListProps {
  billId: Id<'bills'>
  items: Doc<'items'>[]
  participants: Doc<'participants'>[]
  assignments: Doc<'itemAssignments'>[]
  labels: Record<string, string>
}

export function ItemList({
  billId,
  items,
  participants,
  assignments,
  labels,
}: ItemListProps) {
  const addItem = useMutation(api.items.add)
  const removeItem = useMutation(api.items.remove)
  const assignAll = useMutation(api.assignments.assignAll)

  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newQuantity, setNewQuantity] = useState('1')

  const assignedItemIds = useMemo(
    () => new Set(assignments.map((a) => a.itemId)),
    [assignments],
  )
  const firstUnassignedItemId = useMemo(
    () => items.find((item) => !assignedItemIds.has(item._id))?._id,
    [items, assignedItemIds],
  )
  const unassignedCount = items.length - assignedItemIds.size

  function handleScrollToUnassigned() {
    document
      .getElementById('first-unassigned-item')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const unitPriceCents = parseEurInput(newPrice)
    const quantity = Math.max(1, Number.parseInt(newQuantity, 10) || 1)
    setNewName('')
    setNewPrice('')
    setNewQuantity('1')
    try {
      await addItem({ billId, name: trimmed, unitPriceCents, quantity })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handleDelete(item: Doc<'items'>) {
    try {
      await removeItem({ itemId: item._id })
      toast('Артикулът е изтрит', {
        duration: 5000,
        action: {
          label: 'Отмени',
          onClick: () => {
            void addItem({
              billId,
              name: item.name,
              unitPriceCents: item.unitPriceCents,
              quantity: item.quantity,
              note: item.note,
            })
          },
        },
      })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handleAssignAllUnassigned() {
    try {
      await assignAll({ billId, mode: 'unassigned_only' })
      toast.success('Неразпределените артикули са разделени поравно')
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {unassignedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleScrollToUnassigned}>
            <Badge variant="destructive" className="gap-1">
              <AlertTriangleIcon className="size-3" aria-hidden />
              {unassignedCount} неразпределени
            </Badge>
          </button>
          {participants.length > 0 ? (
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
      )}

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Все още няма артикули.</p>
      )}

      {items.map((item) => {
        const itemAssignments = assignments.filter((a) => a.itemId === item._id)
        const isUnassigned = itemAssignments.length === 0
        return (
          <div
            key={item._id}
            id={
              item._id === firstUnassignedItemId
                ? 'first-unassigned-item'
                : undefined
            }
            className={cn(
              'flex flex-col gap-3 rounded-lg border p-4',
              isUnassigned && 'border-l-4 border-amber-500',
            )}
          >
            <ItemRow item={item} onDelete={() => void handleDelete(item)} />
            <AssignmentRow
              itemId={item._id}
              itemQuantity={item.quantity}
              participants={participants}
              labels={labels}
              itemAssignments={itemAssignments}
            />
          </div>
        )
      })}

      <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-item-name">Наименование на артикул</Label>
          <Input
            id="new-item-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Наименование на артикул"
            className="h-11"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="new-item-price">Цена (€)</Label>
            <Input
              id="new-item-price"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              inputMode="decimal"
              placeholder="Цена (€)"
              className="h-11 flex-1"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-item-quantity">Бр.</Label>
            <Input
              id="new-item-quantity"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              inputMode="numeric"
              placeholder="Бр."
              className="h-11 w-16"
            />
          </div>
        </div>
        <Button className="h-11" onClick={handleAdd} disabled={!newName.trim()}>
          <PlusIcon className={ICON.button} aria-hidden />
          Добави артикул
        </Button>
      </div>
    </div>
  )
}

function ItemRow({
  item,
  onDelete,
}: {
  item: Doc<'items'>
  onDelete: () => void
}) {
  const updateItem = useMutation(api.items.update)
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState(() =>
    formatEurInputValue(item.unitPriceCents),
  )
  const [quantity, setQuantity] = useState(String(item.quantity))

  const debouncedSave = useDebouncedCallback(
    (patch: { name?: string; unitPriceCents?: number; quantity?: number }) => {
      void updateItem({ itemId: item._id, ...patch })
    },
    500,
  )

  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-1 flex-col gap-2">
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            debouncedSave({ name: e.target.value })
          }}
          placeholder="Наименование"
          className="h-11"
        />
        <div className="flex items-center gap-2">
          <Input
            value={price}
            onChange={(e) => {
              setPrice(e.target.value)
              debouncedSave({ unitPriceCents: parseEurInput(e.target.value) })
            }}
            inputMode="decimal"
            placeholder="Цена (€)"
            className="h-11 flex-1"
          />
          <span className="text-muted-foreground">×</span>
          <Input
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value)
              const parsed = Math.max(
                1,
                Number.parseInt(e.target.value, 10) || 1,
              )
              debouncedSave({ quantity: parsed })
            }}
            inputMode="numeric"
            placeholder="Бр."
            className="h-11 w-16"
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={`Изтрий ${item.name}`}
        onClick={onDelete}
        className="text-muted-foreground hover:text-destructive dark:hover:text-destructive-foreground"
      >
        <Trash2Icon className="size-4" />
      </Button>
    </div>
  )
}

function formatEurInputValue(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}
