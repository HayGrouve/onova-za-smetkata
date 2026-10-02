import { useEffect, useMemo, useRef, useState } from 'react'
import { diffActivity } from '#/lib/bill-activity.ts'
import type { ActivityEvent, ActivitySnapshot } from '#/lib/bill-activity.ts'
import { indexUnitMembers } from '../../shared/claim-groups.ts'

const MAX_EVENTS = 24

export interface BillActivityInput {
  items: Array<{ _id: string; name: string; quantity: number }>
  assignments: Array<{
    itemId: string
    participantId: string
    unitIndex: number
  }>
  payments: Array<{ participantId: string; amountCents: number }>
  activeSeatIds: string[] | undefined
  labels: Record<string, string>
  /** This phone's own seats: their actions are not news to this phone. */
  quietSeatIds?: string[]
}

/**
 * Activity feed for an open receipt. The first snapshot is the baseline; every
 * later reactive update is diffed against the previous one.
 */
export function useBillActivity({
  items,
  assignments,
  payments,
  activeSeatIds,
  labels,
  quietSeatIds,
}: BillActivityInput): ActivityEvent[] {
  const snapshot = useMemo<ActivitySnapshot | null>(() => {
    // Presence arrives separately; wait for it so joins are not all "new".
    if (activeSeatIds === undefined) return null
    const paidCents = new Map<string, number>()
    for (const payment of payments) {
      paidCents.set(
        payment.participantId,
        (paidCents.get(payment.participantId) ?? 0) + payment.amountCents,
      )
    }
    return {
      unitMembers: indexUnitMembers(assignments),
      itemNames: new Map(items.map((item) => [item._id, item.name])),
      itemQuantities: new Map(items.map((item) => [item._id, item.quantity])),
      activeSeatIds: new Set(activeSeatIds),
      paidCents,
    }
  }, [items, assignments, payments, activeSeatIds])

  const prev = useRef<ActivitySnapshot | null>(null)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const labelsRef = useRef(labels)
  labelsRef.current = labels
  const quietKey = (quietSeatIds ?? []).join(',')

  useEffect(() => {
    if (!snapshot) return
    const before = prev.current
    prev.current = snapshot
    if (!before) return
    const quiet = new Set(quietKey ? quietKey.split(',') : [])
    const fresh = diffActivity(
      before,
      snapshot,
      (id) => labelsRef.current[id] ?? 'Някой',
      Date.now(),
    ).filter((event) => !event.seatIds.some((id) => quiet.has(id)))
    if (fresh.length === 0) return
    setEvents((all) => [...fresh.reverse(), ...all].slice(0, MAX_EVENTS))
  }, [snapshot, quietKey])

  return events
}
