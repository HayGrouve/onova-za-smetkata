import { ArrowRightIcon, PencilIcon } from 'lucide-react'
import { AssignmentRow } from '#/components/bills/assignment-row.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { formatEur } from '#/lib/format-currency.ts'
import type { Doc } from '../../../convex/_generated/dataModel'

export interface ItemAssignSheetProps {
  open: boolean
  item: Doc<'items'> | undefined
  onOpenChange: (open: boolean) => void
  participants: Doc<'participants'>[]
  labels: Record<string, string>
  itemAssignments: Doc<'itemAssignments'>[]
  readOnly: boolean
  /** Items other than this one that still have a free Unit. */
  remainingUnassigned: number
  onNextUnassigned: () => void
  onEditItem: () => void
}

/** Step 3: assign one item line from a compact row (who had it, how many). */
export function ItemAssignSheet({
  open,
  item,
  onOpenChange,
  participants,
  labels,
  itemAssignments,
  readOnly,
  remainingUnassigned,
  onNextUnassigned,
  onEditItem,
}: ItemAssignSheetProps) {
  return (
    <Sheet open={open && item !== undefined} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-xl"
        data-testid="item-assign-sheet"
      >
        {item ? (
          <>
            <SheetHeader className="pr-10">
              <SheetTitle>{item.name}</SheetTitle>
              <SheetDescription className="money">
                {formatEur(item.unitPriceCents)} × {item.quantity} ={' '}
                {formatEur(item.unitPriceCents * item.quantity)}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-3 px-4">
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
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-fit text-muted-foreground"
                  onClick={onEditItem}
                >
                  <PencilIcon className={ICON.button} aria-hidden />
                  Промени името, цената или бройките
                </Button>
              ) : null}
            </div>

            <SheetFooter className="flex-row gap-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => onOpenChange(false)}
              >
                Готово
              </Button>
              {remainingUnassigned > 0 && !readOnly ? (
                <Button
                  type="button"
                  className="h-11 flex-1"
                  onClick={onNextUnassigned}
                >
                  Следващ неразпределен
                  <ArrowRightIcon className={ICON.button} aria-hidden />
                </Button>
              ) : null}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
