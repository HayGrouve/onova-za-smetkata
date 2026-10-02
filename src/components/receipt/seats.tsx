import { createContext, useCallback, useContext, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { buildParticipantInitials } from '#/lib/participant-initials.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import type { ParticipantForLabel } from '#/lib/participant-labels.ts'
import { cn } from '#/lib/utils.ts'

/** A Participant seen as a seat at the table. */
export interface Seat {
  id: string
  label: string
  initials: string
  /** Index into the five seat hues (`--seat-0` … `--seat-4`). */
  hue: number
  isHost: boolean
}

interface SeatDirectory {
  ordered: Seat[]
  byId: Map<string, Seat>
}

const SeatsContext = createContext<SeatDirectory>({
  ordered: [],
  byId: new Map(),
})

export function buildSeats(
  participants: ParticipantForLabel[],
  hostParticipantId: string | null | undefined,
): SeatDirectory {
  const labels = buildParticipantLabels(participants)
  const initials = buildParticipantInitials(labels)
  const ordered = [...participants]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((participant, index) => ({
      id: participant._id,
      label: labels[participant._id] ?? participant.name,
      initials: initials[participant._id] ?? '?',
      hue: index % 5,
      isHost: participant._id === hostParticipantId,
    }))
  return { ordered, byId: new Map(ordered.map((seat) => [seat.id, seat])) }
}

/** Seats for one bill. Receipt pieces below read names, initials and hues from here. */
export function SeatsProvider({
  participants,
  hostParticipantId,
  children,
}: {
  participants: ParticipantForLabel[]
  hostParticipantId: string | null | undefined
  children: ReactNode
}) {
  const value = useMemo(
    () => buildSeats(participants, hostParticipantId),
    [participants, hostParticipantId],
  )
  return <SeatsContext.Provider value={value}>{children}</SeatsContext.Provider>
}

export function useSeats(): Seat[] {
  return useContext(SeatsContext).ordered
}

export function useSeatLookup(): (id: string) => Seat | undefined {
  const { byId } = useContext(SeatsContext)
  return useCallback((id: string) => byId.get(id), [byId])
}

const SIZES = {
  xs: 'size-[22px] text-[9px]',
  sm: 'size-8 text-[11px]',
  md: 'size-11 text-[14px]',
  lg: 'size-14 text-[18px]',
} as const

export type SeatRing = 'none' | 'joined' | 'away' | 'brush' | 'mine'

/**
 * A seat: initials on the seat hue. Identity never rests on colour alone.
 * Rings: joined (solid, the phone is here), away (dashed, has not opened the
 * link), brush (vermilion, host is painting with it), mine (ink, this phone).
 */
export function SeatAvatar({
  seat,
  size = 'sm',
  ring = 'none',
  className,
  style,
}: {
  seat: Pick<Seat, 'initials' | 'hue'>
  size?: keyof typeof SIZES
  ring?: SeatRing
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-[var(--seat-ink)] select-none',
        SIZES[size],
        ring === 'joined' &&
          'ring-2 ring-foreground ring-offset-2 ring-offset-[var(--ring-offset,var(--background))]',
        ring === 'away' &&
          'outline-2 outline-offset-2 outline-muted-foreground outline-dashed',
        ring === 'brush' &&
          'ring-[3px] ring-stamp ring-offset-2 ring-offset-[var(--ring-offset,var(--background))]',
        ring === 'mine' &&
          'ring-2 ring-ink ring-offset-1 ring-offset-[var(--ring-offset,var(--paper))]',
        className,
      )}
      style={{
        background: `var(--seat-${seat.hue})`,
        letterSpacing: seat.initials.length > 1 ? '-0.04em' : 0,
        ...style,
      }}
    >
      {seat.initials}
    </span>
  )
}
