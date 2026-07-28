import { useMutation } from 'convex/react'
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AssignmentRow } from '#/components/bills/assignment-row.tsx'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { useDebouncedCallback } from '#/hooks/use-debounced-callback.ts'
import { ICON } from '#/lib/app-icons.ts'
import { getItemDeleteCopy } from '#/lib/destructive-action-copy.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import {
  itemNameSchema,
  parseItemPriceInput,
  quantityInputSchema,
  validateItemAddForm,
  validateItemNameInput,
  validateItemPriceInput,
  validateItemQuantityInput,
} from '#/lib/item-schema.ts'
import { cn } from '#/lib/utils.ts'
import { itemHasEmptyUnit } from '../../../shared/unit-coverage'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface ItemListProps {
  billId: Id<'bills'>
  items: Doc<'items'>[]
  participants: Doc<'participants'>[]
  assignments: Doc<'itemAssignments'>[]
  labels: Record<string, string>
  readOnly?: boolean
}

export function ItemList({
  billId,
  items,
  participants,
  assignments,
  labels,
  readOnly = false,
}: ItemListProps) {
  const addItem = useMutation(api.items.add)
  const removeItem = useMutation(api.items.remove)
  const assignAll = useMutation(api.assignments.assignAll)
  const { confirm } = useConfirmAction()

  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newQuantity, setNewQuantity] = useState('1')
  const [addOpen, setAddOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    price?: string
    quantity?: string
  }>({})

  const itemHasGap = useMemo(() => {
    return (item: Doc<'items'>) =>
      itemHasEmptyUnit(
        {
          id: item._id,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
        },
        assignments
          .filter((assignment) => assignment.itemId === item._id)
          .map((assignment) => ({
            itemId: assignment.itemId,
            participantId: assignment.participantId,
            unitIndex: assignment.unitIndex,
          })),
      )
  }, [assignments])

  const firstUnassignedItemId = useMemo(
    () => items.find((item) => itemHasGap(item))?._id,
    [items, itemHasGap],
  )
  const unassignedCount = useMemo(
    () => items.filter((item) => itemHasGap(item)).length,
    [items, itemHasGap],
  )

  function handleScrollToUnassigned() {
    document
      .getElementById('first-unassigned-item')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function handleAdd() {
    const validated = validateItemAddForm({
      name: newName,
      priceInput: newPrice,
      quantityInput: newQuantity,
    })
    if (!validated.ok) {
      setAddOpen(true)
      setFieldErrors({
        name: validated.fieldErrors.name,
        price: validated.fieldErrors.price,
        quantity: validated.fieldErrors.quantity,
      })
      return
    }

    setFieldErrors({})
    setNewName('')
    setNewPrice('')
    setNewQuantity('1')
    try {
      await addItem({
        billId,
        name: validated.data.name,
        unitPriceCents: validated.data.unitPriceCents,
        quantity: validated.data.quantity,
        note: validated.data.note,
      })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handleDeleteWithConfirm(item: Doc<'items'>) {
    const confirmed = await confirm(getItemDeleteCopy(item.name))
    if (!confirmed) return
    await handleDelete(item)
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
        const isUnassigned = itemHasGap(item)
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
              isUnassigned && 'border-l-4 border-accent-foreground',
            )}
          >
            <ItemRow
              item={item}
              readOnly={readOnly}
              onDelete={() => void handleDeleteWithConfirm(item)}
            />
            <AssignmentRow
              itemId={item._id}
              itemQuantity={item.quantity}
              participants={participants}
              labels={labels}
              itemAssignments={assignments.filter((a) => a.itemId === item._id)}
            />
          </div>
        )
      })}

      {!readOnly ? (
        <Collapsible open={addOpen} onOpenChange={setAddOpen}>
          <CollapsibleTrigger
            className={cn(
              'tap-feedback flex h-11 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm font-medium',
              'text-muted-foreground hover:bg-muted/50',
            )}
            aria-expanded={addOpen}
          >
            <span className="flex items-center gap-2">
              <PlusIcon className={ICON.button} aria-hidden />
              Добави артикул
            </span>
            <ChevronDownIcon
              className={cn(
                ICON.button,
                'shrink-0 transition-transform duration-200',
                addOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent
            id="add-item-form"
            className="flex flex-col gap-3 pt-3 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-item-name">Наименование на артикул</Label>
              <Input
                id="new-item-name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: undefined }))
                  }
                }}
                placeholder="Наименование на артикул"
                className="h-11"
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor="new-item-price">Цена (€)</Label>
                <Input
                  id="new-item-price"
                  value={newPrice}
                  onChange={(e) => {
                    setNewPrice(e.target.value)
                    if (fieldErrors.price) {
                      setFieldErrors((prev) => ({ ...prev, price: undefined }))
                    }
                  }}
                  inputMode="decimal"
                  placeholder="Цена (€)"
                  className="h-11 flex-1"
                  aria-invalid={Boolean(fieldErrors.price)}
                />
                {fieldErrors.price ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.price}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-item-quantity">Бр.</Label>
                <Input
                  id="new-item-quantity"
                  value={newQuantity}
                  onChange={(e) => {
                    setNewQuantity(e.target.value)
                    if (fieldErrors.quantity) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        quantity: undefined,
                      }))
                    }
                  }}
                  inputMode="numeric"
                  placeholder="Бр."
                  className="h-11 w-16"
                  aria-invalid={Boolean(fieldErrors.quantity)}
                />
                {fieldErrors.quantity ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.quantity}
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              className="h-11"
              onClick={() => void handleAdd()}
              disabled={!newName.trim()}
            >
              <PlusIcon className={ICON.button} aria-hidden />
              Добави
            </Button>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}

function ItemRow({
  item,
  readOnly = false,
  onDelete,
}: {
  item: Doc<'items'>
  readOnly?: boolean
  onDelete: () => void
}) {
  const updateItem = useMutation(api.items.update)
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState(() =>
    formatEurInputValue(item.unitPriceCents),
  )
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    price?: string
    quantity?: string
  }>({})

  const debouncedSave = useDebouncedCallback(
    async (patch: {
      name?: string
      unitPriceCents?: number
      quantity?: number
    }) => {
      try {
        await updateItem({ itemId: item._id, ...patch })
      } catch (error) {
        toast.error(getConvexErrorMessage(error))
      }
    },
    500,
  )

  function scheduleItemFieldSave(
    field: 'name' | 'price' | 'quantity',
    raw: string,
  ) {
    const error =
      field === 'name'
        ? validateItemNameInput(raw)
        : field === 'price'
          ? validateItemPriceInput(raw)
          : validateItemQuantityInput(raw)

    if (error) {
      setFieldErrors((prev) => ({ ...prev, [field]: error }))
      return
    }

    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))

    if (field === 'name') {
      debouncedSave({ name: itemNameSchema.parse(raw) })
      return
    }
    if (field === 'price') {
      const parsed = parseItemPriceInput(raw)
      if (parsed.ok) debouncedSave({ unitPriceCents: parsed.cents })
      return
    }
    const qtyParsed = quantityInputSchema.safeParse(raw)
    if (qtyParsed.success) debouncedSave({ quantity: qtyParsed.data })
  }

  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-1">
          <Input
            value={name}
            disabled={readOnly}
            onChange={(e) => {
              setName(e.target.value)
              scheduleItemFieldSave('name', e.target.value)
            }}
            placeholder="Наименование"
            className="h-11"
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          ) : null}
        </div>
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Input
              value={price}
              disabled={readOnly}
              onChange={(e) => {
                setPrice(e.target.value)
                scheduleItemFieldSave('price', e.target.value)
              }}
              inputMode="decimal"
              placeholder="Цена (€)"
              className="h-11 flex-1"
              aria-invalid={Boolean(fieldErrors.price)}
            />
            {fieldErrors.price ? (
              <p className="text-xs text-destructive">{fieldErrors.price}</p>
            ) : null}
          </div>
          <span className="mt-3 text-muted-foreground">×</span>
          <div className="flex flex-col gap-1">
            <Input
              value={quantity}
              disabled={readOnly}
              onChange={(e) => {
                setQuantity(e.target.value)
                scheduleItemFieldSave('quantity', e.target.value)
              }}
              inputMode="numeric"
              placeholder="Бр."
              className="h-11 w-16"
              aria-invalid={Boolean(fieldErrors.quantity)}
            />
            {fieldErrors.quantity ? (
              <p className="text-xs text-destructive">{fieldErrors.quantity}</p>
            ) : null}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={`Изтрий ${item.name}`}
        disabled={readOnly}
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
