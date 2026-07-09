import { useMutation, useQuery } from 'convex/react'
import { PlusIcon, Trash2Icon, UsersIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
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
import {
  formatFriendGroupErrors,
  parseFriendGroupInput,
} from '#/lib/friend-group-schema.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

const EMPTY_MEMBER_NAMES: string[] = []

export interface FriendGroupEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId?: Id<'friendGroups'>
  initialName?: string
  initialMemberNames?: string[]
  onSaved?: () => void
}

export function FriendGroupEditorSheet({
  open,
  onOpenChange,
  groupId,
  initialName = '',
  initialMemberNames = EMPTY_MEMBER_NAMES,
  onSaved,
}: FriendGroupEditorSheetProps) {
  const existing = useQuery(
    api.friendGroups.get,
    open && groupId ? { groupId } : 'skip',
  )
  const createGroup = useMutation(api.friendGroups.create)
  const updateGroup = useMutation(api.friendGroups.update)
  const removeGroup = useMutation(api.friendGroups.remove)

  const [name, setName] = useState('')
  const [memberNames, setMemberNames] = useState<string[]>([])
  const [memberInput, setMemberInput] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    memberNames?: string
  }>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isEdit = groupId !== undefined
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }

    const justOpened = !wasOpenRef.current
    wasOpenRef.current = true
    if (!justOpened) return

    setFieldErrors({})
    setMemberInput('')

    if (!isEdit) {
      setName(initialName)
      setMemberNames([...initialMemberNames])
    }
  }, [open, isEdit, initialName, initialMemberNames])

  useEffect(() => {
    if (!open || !isEdit || existing === undefined) return

    if (existing === null) {
      setName('')
      setMemberNames([])
      return
    }

    setName(existing.name)
    setMemberNames(existing.memberNames)
  }, [open, isEdit, existing])

  function addMember(rawName?: string) {
    const trimmed = (rawName ?? memberInput).trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    if (memberNames.some((member) => member.toLowerCase() === key)) {
      setFieldErrors((prev) => ({
        ...prev,
        memberNames: 'Името вече е в групата',
      }))
      return
    }
    setFieldErrors((prev) => ({ ...prev, memberNames: undefined }))
    setMemberNames((prev) => [...prev, trimmed])
    setMemberInput('')
  }

  function removeMember(index: number) {
    setMemberNames((prev) => prev.filter((_, i) => i !== index))
  }

  function handleMemberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    addMember()
  }

  async function handleSave() {
    const parsed = parseFriendGroupInput({ name, memberNames })
    if (!parsed.success) {
      setFieldErrors(formatFriendGroupErrors(parsed.error))
      return
    }

    setFieldErrors({})
    setSaving(true)
    try {
      if (isEdit && groupId) {
        await updateGroup({
          groupId,
          name: parsed.data.name,
          memberNames: parsed.data.memberNames,
        })
        toast.success('Групата е запазена')
      } else {
        await createGroup({
          name: parsed.data.name,
          memberNames: parsed.data.memberNames,
        })
        toast.success('Групата е създадена')
      }
      onOpenChange(false)
      onSaved?.()
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!groupId) return
    setDeleting(true)
    try {
      await removeGroup({ groupId })
      toast.success('Групата е изтрита')
      onOpenChange(false)
      onSaved?.()
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const title = isEdit ? 'Редактирай група' : 'Нова група'

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
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="friend-group-name">Име на групата</Label>
            <Input
              id="friend-group-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (fieldErrors.name) {
                  setFieldErrors((prev) => ({ ...prev, name: undefined }))
                }
              }}
              placeholder="Работа обяд"
              autoComplete="off"
            />
            {fieldErrors.name ? (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Участници в групата</Label>
            <div className="flex flex-wrap gap-2">
              {memberNames.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Добавете поне един участник.
                </p>
              ) : null}
              {memberNames.map((member, index) => (
                <span
                  key={`${member}-${index}`}
                  className="flex h-9 items-center gap-1.5 rounded-full border bg-secondary/60 pr-1 pl-3 text-sm"
                >
                  {member}
                  <button
                    type="button"
                    aria-label={`Премахни ${member}`}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                    onClick={() => removeMember(index)}
                  >
                    <XIcon className="size-4" />
                  </button>
                </span>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={handleMemberSubmit}>
              <Input
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                placeholder="Име на участник"
                className="h-11 flex-1"
                autoComplete="off"
              />
              <Button
                type="submit"
                variant="outline"
                className="h-11"
                disabled={!memberInput.trim()}
              >
                <PlusIcon className={ICON.button} aria-hidden />
                Добави
              </Button>
            </form>
            {fieldErrors.memberNames ? (
              <p className="text-sm text-destructive">{fieldErrors.memberNames}</p>
            ) : null}
          </div>
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            onClick={() => void handleSave()}
            disabled={saving || (isEdit && existing === undefined)}
          >
            {saving ? 'Запазване...' : 'Запази'}
          </Button>
          {isEdit ? (
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              <Trash2Icon className={ICON.button} aria-hidden />
              {deleting ? 'Изтриване...' : 'Изтрий групата'}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
