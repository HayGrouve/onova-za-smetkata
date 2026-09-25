import { useState } from 'react'
import { useMutation } from 'convex/react'
import { ListIcon, MinusIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '#/lib/utils.ts'
import { ICON } from '#/lib/app-icons.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { HostUnitAssignmentDialog } from '#/components/bills/host-unit-assignment-dialog.tsx'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { indexUnitMembers, unitKey } from '../../../shared/claim-groups'
import { isParticipantOnUnit } from '../../../shared/unit-coverage'

export interface AssignmentRowProps {
  itemId: Id<'items'>
  itemName: string
  itemQuantity: number
  itemUnitPriceCents: number
  participants: Doc<'participants'>[]
  labels: Record<string, string>
  itemAssignments: Doc<'itemAssignments'>[]
  readOnly?: boolean
}

export function AssignmentRow({
  itemId,
  itemName,
  itemQuantity,
  itemUnitPriceCents,
  participants,
  labels,
  itemAssignments,
  readOnly = false,
}: AssignmentRowProps) {
  const joinUnit = useMutation(api.assignments.joinUnit)
  const leaveUnit = useMutation(api.assignments.leaveUnit)
  const takeUnit = useMutation(api.assignments.takeUnit)
  const releaseUnit = useMutation(api.assignments.releaseUnit)
  const assignEven = useMutation(api.assignments.assignEven)
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const assignmentInputs = itemAssignments.map((assignment) => ({
    itemId: assignment.itemId,
    participantId: assignment.participantId,
    unitIndex: assignment.unitIndex,
  }))

  async function run(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleAssignEven() {
    await run(async () => {
      await assignEven({ itemId })
      toast.success('Разпределено поравно между всички')
    })
  }

  async function handleToggle(participantId: Id<'participants'>) {
    const isAssigned = isParticipantOnUnit(
      itemId,
      0,
      participantId,
      assignmentInputs,
    )
    await run(() =>
      isAssigned
        ? leaveUnit({ itemId, participantId, unitIndex: 0 })
        : joinUnit({ itemId, participantId, unitIndex: 0 }),
    )
  }

  if (participants.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Добавете участници, за да разпределите артикула.
      </p>
    )
  }

  if (itemQuantity === 1) {
    const assignedCount = itemAssignments.length
    return (
      <div className="flex flex-col gap-2">
        {assignedCount > 1 ? (
          <Badge variant="secondary">Споделено ({assignedCount})</Badge>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {participants.map((participant) => {
            const isAssigned = isParticipantOnUnit(
              itemId,
              0,
              participant._id,
              assignmentInputs,
            )
            return (
              <button
                key={participant._id}
                type="button"
                aria-pressed={isAssigned}
                disabled={readOnly || busy}
                onClick={() => void handleToggle(participant._id)}
                className={chipClassName(isAssigned)}
              >
                {labels[participant._id] ?? participant.name}
              </button>
            )
          })}
        </div>
        {!readOnly ? (
          <p className="text-xs text-muted-foreground">
            Изберете няколко души, ако са го споделили.
          </p>
        ) : null}
        {!readOnly ? renderAssignEvenButton(handleAssignEven, busy) : null}
      </div>
    )
  }

  const membersByUnit = indexUnitMembers(assignmentInputs)
  const units = Array.from({ length: itemQuantity }, (_, unitIndex) => ({
    itemId,
    unitIndex,
  }))
  const unitMembers = units.map(
    (unit) => membersByUnit.get(unitKey(unit)) ?? [],
  )
  const freeCount = unitMembers.filter((members) => members.length === 0).length

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {freeCount > 0
          ? `Свободни: ${freeCount} от ${itemQuantity} — задайте колко бройки има всеки.`
          : `Всички ${itemQuantity} бройки са разпределени.`}
      </p>
      <ul className="flex flex-col gap-1">
        {participants.map((participant) => {
          const solo = unitMembers.filter(
            (members) => members.length === 1 && members[0] === participant._id,
          ).length
          const shared = unitMembers.filter(
            (members) =>
              members.length > 1 && members.includes(participant._id),
          ).length
          const label = labels[participant._id] ?? participant.name
          return (
            <li
              key={participant._id}
              className="flex items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate text-sm">
                {label}
                {shared > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {' '}
                    · +{shared} споделени
                  </span>
                ) : null}
              </span>
              <div
                className="flex shrink-0 items-center rounded-lg border"
                role="group"
                aria-label={`Бройки ${itemName} за ${label}`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  aria-label={`Една ${itemName} по-малко за ${label}`}
                  disabled={readOnly || busy || solo === 0}
                  onClick={() =>
                    void run(() =>
                      releaseUnit({
                        itemIds: [itemId],
                        participantId: participant._id,
                      }),
                    )
                  }
                >
                  <MinusIcon className="size-4" />
                </Button>
                <span className="money min-w-7 text-center font-semibold">
                  {solo}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10"
                  aria-label={`Още една ${itemName} за ${label}`}
                  disabled={readOnly || busy || freeCount === 0}
                  onClick={() =>
                    void run(() =>
                      takeUnit({
                        itemIds: [itemId],
                        participantId: participant._id,
                      }),
                    )
                  }
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          {renderAssignEvenButton(handleAssignEven, busy)}
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-fit"
            onClick={() => setEditOpen(true)}
            data-testid={`host-unit-edit-${itemId}`}
          >
            <ListIcon className={ICON.button} aria-hidden />
            По бройки…
          </Button>
        </div>
      ) : null}
      <HostUnitAssignmentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        item={{
          _id: itemId,
          name: itemName,
          quantity: itemQuantity,
          unitPriceCents: itemUnitPriceCents,
        }}
        participants={participants}
        itemAssignments={itemAssignments}
        participantLabels={labels}
      />
    </div>
  )
}

function renderAssignEvenButton(onClick: () => Promise<void>, busy: boolean) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-fit"
      disabled={busy}
      onClick={() => void onClick()}
    >
      <UsersIcon className={ICON.button} aria-hidden />
      Раздели поравно между всички
    </Button>
  )
}

function chipClassName(isAssigned: boolean) {
  return cn(
    'flex min-h-11 items-center rounded-full border px-3.5 text-xs font-medium transition-colors disabled:opacity-60',
    isAssigned
      ? 'border-primary/50 bg-primary/15 text-foreground dark:border-primary/40 dark:bg-primary/20'
      : 'border-input bg-background/60 text-muted-foreground hover:bg-accent/50',
  )
}
