import { useMutation, useQuery } from 'convex/react'
import { XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface ParticipantListProps {
  billId: Id<'bills'>
  participants: Doc<'participants'>[]
  labels: Record<string, string>
}

export function ParticipantList({
  billId,
  participants,
  labels,
}: ParticipantListProps) {
  const [name, setName] = useState('')
  const addParticipant = useMutation(api.participants.add)
  const removeParticipant = useMutation(api.participants.remove)
  const recentNames = useQuery(api.participants.listRecentNames, { limit: 12 })

  const currentNames = new Set(
    participants.map((p) => p.name.trim().toLowerCase()),
  )
  const quickAddNames =
    recentNames?.filter(
      (recentName) => !currentNames.has(recentName.trim().toLowerCase()),
    ) ?? []

  async function handleAdd(participantName?: string) {
    const trimmed = (participantName ?? name).trim()
    if (!trimmed) return
    setName('')
    await addParticipant({ billId, name: trimmed })
  }

  async function handleRemove(participant: Doc<'participants'>) {
    await removeParticipant({ participantId: participant._id })
    toast('Участникът е премахнат', {
      duration: 5000,
      action: {
        label: 'Отмени',
        onClick: () => {
          void addParticipant({ billId, name: participant.name })
        },
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {participants.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Все още няма участници.
          </p>
        )}
        {participants.map((participant) => (
          <span
            key={participant._id}
            className="flex h-9 items-center gap-1.5 rounded-full border bg-secondary/60 pr-1 pl-3 text-sm"
          >
            {labels[participant._id] ?? participant.name}
            <button
              type="button"
              aria-label={`Премахни ${participant.name}`}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => handleRemove(participant)}
            >
              <XIcon className="size-4" />
            </button>
          </span>
        ))}
      </div>
      {quickAddNames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickAddNames.map((recentName) => (
            <Button
              key={recentName}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full"
              onClick={() => void handleAdd(recentName)}
            >
              {recentName}
            </Button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleAdd()
            }
          }}
          placeholder="Име на участник"
          className="h-11 flex-1"
        />
        <Button
          className="h-11"
          onClick={() => void handleAdd()}
          disabled={!name.trim()}
        >
          Добави
        </Button>
      </div>
    </div>
  )
}
