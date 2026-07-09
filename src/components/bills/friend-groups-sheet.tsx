import { useQuery } from 'convex/react'
import { ChevronRightIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { FriendGroupEditorSheet } from '#/components/bills/friend-group-editor-sheet.tsx'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export interface FriendGroupsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FriendGroupsSheet({ open, onOpenChange }: FriendGroupsSheetProps) {
  const groups = useQuery(api.friendGroups.listAll, open ? {} : 'skip')
  const [editorOpen, setEditorOpen] = useState(false)
  const [returnToSettings, setReturnToSettings] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<
    Id<'friendGroups'> | undefined
  >(undefined)

  function openCreate() {
    setEditingGroupId(undefined)
    setReturnToSettings(true)
    onOpenChange(false)
    setEditorOpen(true)
  }

  function openEdit(groupId: Id<'friendGroups'>) {
    setEditingGroupId(groupId)
    setReturnToSettings(true)
    onOpenChange(false)
    setEditorOpen(true)
  }

  function handleEditorOpenChange(nextOpen: boolean) {
    setEditorOpen(nextOpen)
    if (!nextOpen && returnToSettings) {
      setReturnToSettings(false)
      onOpenChange(true)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-lg rounded-t-xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UsersIcon className={ICON.section} aria-hidden />
              Моите групи
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-3 px-4 pb-4">
            <Button type="button" variant="outline" onClick={openCreate}>
              <PlusIcon className={ICON.button} aria-hidden />
              Нова група
            </Button>

            {groups === undefined ? (
              <p className="text-sm text-muted-foreground">Зареждане...</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Запазете хора от сметка или създайте група тук.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {groups.map((group) => (
                  <li key={group._id}>
                    <button
                      type="button"
                      className="tap-feedback flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left"
                      onClick={() => openEdit(group._id)}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{group.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {group.memberCount}{' '}
                          {group.memberCount === 1 ? 'участник' : 'участника'}
                        </p>
                      </div>
                      <ChevronRightIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <FriendGroupEditorSheet
        open={editorOpen}
        onOpenChange={handleEditorOpenChange}
        groupId={editingGroupId}
      />
    </>
  )
}
