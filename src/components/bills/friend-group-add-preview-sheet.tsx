import { useMutation } from 'convex/react'
import { UsersIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { summarizeAddMembersToBill } from '#/lib/friend-group-schema.ts'
import { writeLastFriendGroupId } from '#/lib/last-friend-group-storage.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface FriendGroupPreview {
  _id: Id<'friendGroups'>
  name: string
  memberNames: string[]
}

export interface FriendGroupAddPreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: FriendGroupPreview | null
  billId: Id<'bills'>
  participants: Doc<'participants'>[]
}

export function FriendGroupAddPreviewSheet({
  open,
  onOpenChange,
  group,
  billId,
  participants,
}: FriendGroupAddPreviewSheetProps) {
  const addToBill = useMutation(api.friendGroups.addToBill)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  const currentNames = useMemo(
    () => new Set(participants.map((p) => p.name.trim().toLowerCase())),
    [participants],
  )

  const rows = useMemo(() => {
    if (!group) return []
    return group.memberNames.map((name) => {
      const key = name.trim().toLowerCase()
      return {
        name,
        key,
        alreadyOnBill: currentNames.has(key),
      }
    })
  }, [group, currentNames])

  useEffect(() => {
    if (!open || !group) return
    const initial = new Set<string>()
    for (const row of rows) {
      if (!row.alreadyOnBill) {
        initial.add(row.key)
      }
    }
    setSelected(initial)
  }, [open, group, rows])

  async function handleAdd(names?: string[]) {
    if (!group) return
    setAdding(true)
    try {
      const result = await addToBill({
        billId,
        groupId: group._id,
        names,
      })
      writeLastFriendGroupId(group._id)
      toast.success(summarizeAddMembersToBill(result))
      onOpenChange(false)
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setAdding(false)
    }
  }

  const selectableCount = rows.filter((row) => !row.alreadyOnBill).length
  const selectedCount = rows.filter(
    (row) => !row.alreadyOnBill && selected.has(row.key),
  ).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UsersIcon className={ICON.section} aria-hidden />
            Добави от: {group?.name ?? '...'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto px-4">
          {rows.map((row) => {
            const checked = row.alreadyOnBill || selected.has(row.key)
            return (
              <div
                key={row.key}
                className="flex items-center gap-3 rounded-lg border px-3 py-2"
              >
                <Checkbox
                  id={`group-member-${row.key}`}
                  checked={checked}
                  disabled={row.alreadyOnBill}
                  onCheckedChange={(value) => {
                    if (row.alreadyOnBill) return
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (value) {
                        next.add(row.key)
                      } else {
                        next.delete(row.key)
                      }
                      return next
                    })
                  }}
                />
                <Label
                  htmlFor={`group-member-${row.key}`}
                  className="flex flex-1 items-center justify-between gap-2 font-normal"
                >
                  <span>{row.name}</span>
                  {row.alreadyOnBill ? (
                    <span className="text-xs text-muted-foreground">
                      Вече добавен
                    </span>
                  ) : null}
                </Label>
              </div>
            )
          })}
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={adding || selectedCount === 0}
            onClick={() =>
              void handleAdd(
                rows
                  .filter((row) => !row.alreadyOnBill && selected.has(row.key))
                  .map((row) => row.name),
              )
            }
          >
            {adding ? 'Добавяне...' : `Добави избраните (${selectedCount})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={adding || selectableCount === 0}
            onClick={() => void handleAdd()}
          >
            Добави всички
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
