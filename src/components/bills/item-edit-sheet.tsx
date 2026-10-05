import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { ItemFormSheet } from '#/components/bills/item-form-sheet.tsx'
import { getItemDeleteCopy } from '#/lib/destructive-action-copy.ts'
import { getConvexErrorMessage } from '#/lib/convex-error.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface ItemEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billId: Id<'bills'>
  /** Edit this item; add a new one when omitted. */
  item?: Doc<'items'>
}

/** Add or edit one item line of a bill. */
export function ItemEditSheet({
  open,
  onOpenChange,
  billId,
  item,
}: ItemEditSheetProps) {
  const addItem = useMutation(api.items.add)
  const updateItem = useMutation(api.items.update)
  const removeItem = useMutation(api.items.remove)
  const { confirm } = useConfirmAction()

  async function handleDelete() {
    if (!item) return
    const confirmed = await confirm(getItemDeleteCopy(item.name))
    if (!confirmed) return
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

  return (
    <ItemFormSheet
      open={open}
      onOpenChange={onOpenChange}
      item={item}
      itemKey={item?._id}
      onSave={async (data, changes) => {
        try {
          if (item) {
            // Send only what was edited here: another tab or phone may have
            // changed the rest since, and a stale quantity would drop claims.
            await updateItem({ itemId: item._id, ...changes })
          } else {
            await addItem({
              billId,
              name: data.name,
              unitPriceCents: data.unitPriceCents,
              quantity: data.quantity,
            })
          }
          return true
        } catch (error) {
          toast.error(getConvexErrorMessage(error))
          return false
        }
      }}
      onDelete={() => void handleDelete()}
    />
  )
}
