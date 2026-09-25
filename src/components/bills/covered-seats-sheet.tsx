import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CoveredSeatsPicker } from '#/components/bills/covered-seats-picker.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import type { CoveredSeatCandidate } from '#/lib/covered-seat-candidates.ts'
import {
  getConvexErrorMessage,
  getStoredGuestSession,
  setStoredGuestSession,
} from '#/lib/guest-participant-session.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export interface CoveredSeatsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billId: Id<'bills'>
  shareToken: string
  sessionToken: string
  candidates: CoveredSeatCandidate[]
  coveredIds: string[]
}

/** Change which other seats this phone claims and pays for. */
export function CoveredSeatsSheet({
  open,
  onOpenChange,
  billId,
  shareToken,
  sessionToken,
  candidates,
  coveredIds,
}: CoveredSeatsSheetProps) {
  const updateCoveredSeats = useMutation(api.guestSessions.updateCoveredSeats)
  const [selected, setSelected] = useState<string[]>(coveredIds)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setSelected(coveredIds)
    // Reset only when the sheet opens.
  }, [open])

  async function handleSave() {
    setSaving(true)
    try {
      const result = await updateCoveredSeats({
        billId,
        shareToken,
        sessionToken,
        coveredParticipantIds: selected as Id<'participants'>[],
      })
      const stored = getStoredGuestSession(billId)
      if (stored) {
        setStoredGuestSession({
          ...stored,
          coveredParticipantIds: result.coveredParticipantIds,
        })
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85dvh] max-w-lg rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle>За кого още отбелязвате?</SheetTitle>
          <SheetDescription>
            Изберете хората, чиито артикули отбелязвате и плащате от този
            телефон — например половинката ви.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-4">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Няма други участници.
            </p>
          ) : (
            <CoveredSeatsPicker
              candidates={candidates}
              selectedIds={selected}
              disabled={saving}
              onToggle={(id) =>
                setSelected((current) =>
                  current.includes(id)
                    ? current.filter((entry) => entry !== id)
                    : [...current, id],
                )
              }
            />
          )}
        </div>
        <SheetFooter>
          <Button
            type="button"
            className="h-11"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            Запази
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
