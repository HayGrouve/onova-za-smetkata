import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { validateItemAddForm } from '../../../shared/item-schema.ts'
import type { ItemAddData, ItemField } from '../../../shared/item-schema.ts'
import { formatEurInputValue } from '../../../shared/tip-calculations.ts'
import { QUANTITY_MAX } from '../../../shared/validation/constants.ts'

export interface ItemFormValues {
  name: string
  unitPriceCents: number
  quantity: number
}

type FieldErrors = Partial<Record<ItemField, string>>

/**
 * Add or edit one item line: name, unit price, quantity. Where the line is
 * saved (a bill on the server, a quick bill on the phone) is the caller's.
 */
export function ItemFormSheet({
  open,
  onOpenChange,
  item,
  itemKey,
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this line; add a new one when omitted. */
  item?: ItemFormValues
  /** The edited line's id: the form resets when it opens for another line. */
  itemKey?: string
  /**
   * `changes` holds only the fields edited here. Resolves false when saving
   * failed and the sheet should stay as it is.
   */
  onSave: (
    data: ItemAddData,
    changes: Partial<ItemFormValues>,
  ) => Promise<boolean>
  /** Offered when editing; the sheet closes before it runs. */
  onDelete?: () => void
}) {
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  /** The line as this sheet first showed it; only edited fields are saved. */
  const openedWithRef = useRef<ItemFormValues | null>(null)

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setPrice(item ? formatEurInputValue(item.unitPriceCents) : '')
    setQuantity(String(item?.quantity ?? 1))
    setFieldErrors({})
    openedWithRef.current = item
      ? {
          name: item.name,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
        }
      : null
    // Reset only when the sheet opens for an item (or for adding).
  }, [open, itemKey])

  function clearError(field: ItemField) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function stepQuantity(delta: number) {
    const current = Number.parseInt(quantity, 10)
    const base = Number.isFinite(current) ? current : 1
    setQuantity(String(Math.min(QUANTITY_MAX, Math.max(1, base + delta))))
    clearError('quantity')
  }

  async function save(options: { addAnother: boolean }) {
    const validated = validateItemAddForm({
      name,
      priceInput: price,
      quantityInput: quantity,
    })
    if (!validated.ok) {
      setFieldErrors(validated.fieldErrors)
      return
    }

    const openedWith = openedWithRef.current
    const changes: Partial<ItemFormValues> = {
      ...(validated.data.name !== openedWith?.name
        ? { name: validated.data.name }
        : {}),
      ...(validated.data.unitPriceCents !== openedWith?.unitPriceCents
        ? { unitPriceCents: validated.data.unitPriceCents }
        : {}),
      ...(validated.data.quantity !== openedWith?.quantity
        ? { quantity: validated.data.quantity }
        : {}),
    }

    setSaving(true)
    try {
      if (!(await onSave(validated.data, changes))) return
      if (options.addAnother) {
        setName('')
        setPrice('')
        setQuantity('1')
        setFieldErrors({})
        toast.success(`„${validated.data.name}“ е добавен`)
        nameRef.current?.focus()
      } else {
        onOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-xl"
        data-testid="item-edit-sheet"
      >
        <SheetHeader>
          <SheetTitle>
            {item ? 'Редакция на артикул' : 'Нов артикул'}
          </SheetTitle>
          <SheetDescription>
            Цената е за една бройка — бройките я умножават.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-col gap-4 px-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save({ addAnother: false })
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-name">Наименование</Label>
            <Input
              ref={nameRef}
              id="item-name"
              value={name}
              autoComplete="off"
              placeholder="Напр. Бира Загорка"
              className="h-11"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={
                fieldErrors.name ? 'item-name-error' : undefined
              }
              onChange={(event) => {
                setName(event.target.value)
                clearError('name')
              }}
            />
            {fieldErrors.name ? (
              <p id="item-name-error" className="text-xs text-destructive">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div className="flex gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor="item-price">Цена за бройка (€)</Label>
              <Input
                id="item-price"
                value={price}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                className="h-11"
                aria-invalid={Boolean(fieldErrors.price)}
                aria-describedby={
                  fieldErrors.price ? 'item-price-error' : undefined
                }
                onChange={(event) => {
                  setPrice(event.target.value)
                  clearError('price')
                }}
              />
              {fieldErrors.price ? (
                <p id="item-price-error" className="text-xs text-destructive">
                  {fieldErrors.price}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-quantity">Бройки</Label>
              <div className="flex h-11 items-center rounded-md border">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label="Една бройка по-малко"
                  onClick={() => stepQuantity(-1)}
                >
                  <MinusIcon className="size-4" />
                </Button>
                <Input
                  id="item-quantity"
                  value={quantity}
                  inputMode="numeric"
                  autoComplete="off"
                  className="h-9 w-12 border-0 px-0 text-center shadow-none focus-visible:ring-0"
                  aria-invalid={Boolean(fieldErrors.quantity)}
                  aria-describedby={
                    fieldErrors.quantity ? 'item-quantity-error' : undefined
                  }
                  onChange={(event) => {
                    setQuantity(event.target.value)
                    clearError('quantity')
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label="Една бройка повече"
                  onClick={() => stepQuantity(1)}
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>
              {fieldErrors.quantity ? (
                <p
                  id="item-quantity-error"
                  className="text-xs text-destructive"
                >
                  {fieldErrors.quantity}
                </p>
              ) : null}
            </div>
          </div>
          {item && Number.parseInt(quantity, 10) < item.quantity ? (
            <p className="text-xs text-muted-foreground">
              Намалените бройки губят отбелязванията си.
            </p>
          ) : null}
          {/* Submit on Enter from any field. */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>

        <SheetFooter className="gap-2">
          <Button
            type="button"
            className="h-11"
            disabled={saving}
            onClick={() => void save({ addAnother: false })}
          >
            {item ? 'Запази' : 'Добави'}
          </Button>
          {item && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-destructive hover:text-destructive"
              disabled={saving}
              onClick={() => {
                onOpenChange(false)
                onDelete()
              }}
            >
              <Trash2Icon className={ICON.button} aria-hidden />
              Изтрий артикула
            </Button>
          ) : !item ? (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={saving}
              onClick={() => void save({ addAnother: true })}
            >
              Добави и още един
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
