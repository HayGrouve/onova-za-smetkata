import type {
  BillBreakdownInput,
  ParticipantTotals,
} from '#/lib/bill-calculations.ts'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { ParticipantBreakdownContent } from '#/components/bills/participant-breakdown-content.tsx'
import type { Id } from '../../../convex/_generated/dataModel'

export interface ParticipantDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  breakdownInput: BillBreakdownInput
  totals: ParticipantTotals
  onOpenPaymentSettings?: () => void
  showPaymentActions?: boolean
  showPayActions?: boolean
}

export function ParticipantDetailSheet({
  open,
  onOpenChange,
  billId,
  participantId,
  label,
  breakdownInput,
  totals,
  onOpenPaymentSettings,
  showPaymentActions = true,
  showPayActions = true,
}: ParticipantDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] max-w-lg rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="pr-8">{label}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <ParticipantBreakdownContent
            billId={billId}
            participantId={participantId}
            label={label}
            breakdownInput={breakdownInput}
            totals={totals}
            onOpenPaymentSettings={onOpenPaymentSettings}
            showPaymentActions={showPaymentActions}
            showPayActions={showPayActions}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
