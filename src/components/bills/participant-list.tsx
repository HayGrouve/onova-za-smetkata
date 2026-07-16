import { useMutation, useQuery } from 'convex/react'
import {
  MoreHorizontalIcon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import {
  FriendGroupAddPreviewSheet,
  type FriendGroupPreview,
} from '#/components/bills/friend-group-add-preview-sheet.tsx'
import { useFriendGroups } from '#/components/bills/friend-groups-provider.tsx'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import {
  getClearAllGuestsCopy,
  getParticipantRemoveCopy,
} from '#/lib/destructive-action-copy.ts'
import { summarizeAddMembersToBill } from '#/lib/friend-group-schema.ts'
import { isHostParticipant } from '../../../shared/host-bill-participant.ts'
import {
  readLastFriendGroupId,
  writeLastFriendGroupId,
} from '#/lib/last-friend-group-storage.ts'
import { sortFriendGroupsWithPinned } from '#/lib/sort-friend-groups-with-pinned.ts'
import { cn } from '#/lib/utils.ts'
import { validateParticipantAdd } from '#/lib/participant-schema.ts'
import { Input } from '#/components/ui/input.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface ParticipantListProps {
  billId: Id<'bills'>
  participants: Doc<'participants'>[]
  labels: Record<string, string>
  hostParticipantId?: Id<'participants'>
  readOnly?: boolean
  suggestedGroupName?: string
}

export function ParticipantList({
  billId,
  participants,
  labels,
  hostParticipantId,
  readOnly = false,
  suggestedGroupName = '',
}: ParticipantListProps) {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [previewGroup, setPreviewGroup] = useState<FriendGroupPreview | null>(
    null,
  )
  const [previewOpen, setPreviewOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const addParticipant = useMutation(api.participants.add)
  const addGroupToBill = useMutation(api.friendGroups.addToBill)
  const removeParticipant = useMutation(api.participants.remove)
  const removeAllGuests = useMutation(api.participants.removeAllGuests)
  const recentNames = useQuery(api.participants.listRecentNames, { limit: 12 })
  const friendGroups = useQuery(api.friendGroups.list, {})
  const { groups: orderedFriendGroups, pinnedId: pinnedGroupId } = useMemo(() => {
    if (!friendGroups) return { groups: [], pinnedId: null }
    return sortFriendGroupsWithPinned(friendGroups, readLastFriendGroupId())
  }, [friendGroups])
  const { openNewFriendGroup } = useFriendGroups()
  const { confirm } = useConfirmAction()

  const currentNames = new Set(
    participants.map((p) => p.name.trim().toLowerCase()),
  )
  const guestParticipants = participants.filter(
    (participant) =>
      !isHostParticipant(participant._id, hostParticipantId),
  )
  const quickAddNames =
    recentNames?.filter(
      (recentName) => !currentNames.has(recentName.trim().toLowerCase()),
    ) ?? []

  async function handleAdd(participantName?: string) {
    const raw = participantName ?? name
    const validated = validateParticipantAdd(
      { name: raw },
      {
        existingNames: participants.map((participant) => participant.name),
        participantCount: participants.length,
      },
    )
    if (!validated.ok) {
      if (participantName === undefined) {
        setNameError(validated.message)
      } else {
        toast.error(validated.message)
      }
      return
    }

    setNameError(undefined)
    if (participantName === undefined) {
      setName('')
    }
    try {
      await addParticipant({ billId, name: validated.name })
      nameInputRef.current?.focus()
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void handleAdd()
  }

  async function handleRemoveWithConfirm(participant: Doc<'participants'>) {
    const label = labels[participant._id] ?? participant.name
    const confirmed = await confirm(getParticipantRemoveCopy(label))
    if (!confirmed) return
    await handleRemove(participant)
  }

  async function handleRemove(participant: Doc<'participants'>) {
    try {
      await removeParticipant({ participantId: participant._id })
      toast('Участникът е премахнат', {
        duration: 5000,
        action: {
          label: 'Отмени',
          onClick: () => {
            void handleAdd(participant.name)
          },
        },
      })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handleClearAllGuestsWithConfirm() {
    const confirmed = await confirm(
      getClearAllGuestsCopy(guestParticipants.length),
    )
    if (!confirmed) return
    try {
      const result = await removeAllGuests({ billId })
      toast.success(
        result.removedCount === 1
          ? '1 гост е премахнат'
          : `${result.removedCount} госта са премахнати`,
      )
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handleAddGroupAll(group: FriendGroupPreview) {
    try {
      const result = await addGroupToBill({ billId, groupId: group._id })
      writeLastFriendGroupId(group._id)
      toast.success(summarizeAddMembersToBill(result))
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  function openPreview(group: FriendGroupPreview) {
    setPreviewGroup(group)
    setPreviewOpen(true)
  }

  function openSaveParticipantsAsGroup() {
    const memberNames = participants.map((participant) => participant.name)
    const suggestedName =
      suggestedGroupName.trim() ||
      `Група от ${new Date().toLocaleDateString('bg-BG')}`
    openNewFriendGroup({ memberNames, suggestedName })
  }

  const showAddControls = !readOnly

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Участници на сметката" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            На сметката
          </p>
          {showAddControls && guestParticipants.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => void handleClearAllGuestsWithConfirm()}
            >
              Изчисти всички
            </Button>
          ) : null}
        </div>
        <div className="min-h-9 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5">
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Все още няма участници.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {participants.map((participant) => (
                <span
                  key={participant._id}
                  className="flex h-9 items-center gap-1.5 rounded-full border bg-secondary/60 pr-1 pl-3 text-sm"
                >
                  {labels[participant._id] ?? participant.name}
                  {!readOnly ? (
                    <button
                      type="button"
                      aria-label={`Премахни ${participant.name}`}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                      onClick={() => void handleRemoveWithConfirm(participant)}
                    >
                      <XIcon className="size-4" />
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {showAddControls ? (
        <>
          <Separator />
          <section
            aria-label="Добавяне на участници"
            className="flex flex-col gap-4 rounded-lg border border-dashed border-border/80 bg-muted/25 p-3"
          >
            <p className="text-sm font-medium">Добави участници</p>

            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">От група</p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {orderedFriendGroups.map((group) => (
                  <div
                    key={group._id}
                    className={cn(
                      'flex shrink-0 items-stretch overflow-hidden rounded-full border',
                      group._id === pinnedGroupId
                        ? 'border-solid border-primary/50'
                        : 'border-dashed',
                    )}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 max-w-48 rounded-r-none border-0 px-3"
                      onClick={() => void handleAddGroupAll(group)}
                    >
                      {group._id === pinnedGroupId ? (
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                            Последна
                          </span>
                          <span className="truncate">{group.name}</span>
                        </span>
                      ) : (
                        <span className="truncate">{group.name}</span>
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className={cn(
                            'h-8 w-8 shrink-0 rounded-l-none border-0 border-l',
                            group._id === pinnedGroupId
                              ? 'border-solid border-primary/50'
                              : 'border-dashed',
                          )}
                          aria-label={`Опции за група ${group.name}`}
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openPreview(group)}>
                          Избери участници
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 rounded-full border-dashed"
                    >
                      + Група
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => openNewFriendGroup()}>
                      Нова група
                    </DropdownMenuItem>
                    {participants.length >= 2 ? (
                      <DropdownMenuItem onSelect={openSaveParticipantsAsGroup}>
                        Запази участниците като група
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {quickAddNames.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">Скорошни</p>
                <div className="flex flex-wrap gap-2">
                  {quickAddNames.map((recentName) => (
                    <Button
                      key={recentName}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-dashed"
                      onClick={() => void handleAdd(recentName)}
                    >
                      + {recentName}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Ръчно</p>
              <form className="flex flex-col gap-1.5" onSubmit={handleSubmit}>
                <div className="flex gap-2">
                  <Input
                    ref={nameInputRef}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (nameError) setNameError(undefined)
                    }}
                    placeholder="Име на участник"
                    className="h-11 flex-1"
                    autoComplete="off"
                    aria-invalid={Boolean(nameError)}
                  />
                  <Button type="submit" className="h-11" disabled={!name.trim()}>
                    <UserPlusIcon className={ICON.button} aria-hidden />
                    Добави
                  </Button>
                </div>
                {nameError ? (
                  <p className="text-xs text-destructive">{nameError}</p>
                ) : null}
              </form>
            </div>
          </section>
        </>
      ) : null}

      <FriendGroupAddPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        group={previewGroup}
        billId={billId}
        participants={participants}
      />
    </div>
  )
}
