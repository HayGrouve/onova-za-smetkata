import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface AssignmentToolbarProps {
  billId: Id<'bills'>
  items: Doc<'items'>[]
  assignments: Doc<'itemAssignments'>[]
  participants: Doc<'participants'>[]
}

export function AssignmentToolbar({
  billId,
  items,
  assignments,
  participants,
}: AssignmentToolbarProps) {
  const assignAll = useMutation(api.assignments.assignAll)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const assignedItemIds = new Set(assignments.map((a) => a.itemId))
  const unassignedCount = items.filter(
    (item) => !assignedItemIds.has(item._id),
  ).length
  const disabled = participants.length === 0 || items.length === 0

  async function handleAssignAll() {
    setConfirmOpen(false)
    setIsAssigning(true)
    try {
      await assignAll({ billId, mode: 'all_items' })
      toast.success('Всички артикули са разпределени по равно')
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleAssignRemaining() {
    setIsAssigning(true)
    try {
      await assignAll({ billId, mode: 'unassigned_only' })
      toast.success('Оставащите артикули са разпределени по равно')
    } finally {
      setIsAssigning(false)
    }
  }

  function handleScrollToUnassigned() {
    document
      .getElementById('first-unassigned-item')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isAssigning}
          onClick={() => setConfirmOpen(true)}
        >
          Разпредели всички по равно
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isAssigning}
          onClick={() => void handleAssignRemaining()}
        >
          Разпредели оставащите по равно
        </Button>
        {unassignedCount > 0 && (
          <button type="button" onClick={handleScrollToUnassigned}>
            <Badge variant="destructive">{unassignedCount} неразпределени</Badge>
          </button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Разпредели всички по равно?</DialogTitle>
            <DialogDescription>
              Това ще замени текущите разпределения — всеки артикул ще бъде
              поделен между всички участници.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Отказ
            </Button>
            <Button onClick={() => void handleAssignAll()}>Разпредели</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
