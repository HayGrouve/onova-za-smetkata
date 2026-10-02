/**
 * Live activity on a bill ("Деси взе Пилешка пържола"), derived on the client
 * by diffing two successive reactive snapshots. There is no server-side log:
 * you see what happens while the receipt is open.
 */

export interface ActivitySnapshot {
  /** Unit key (`itemId:unitIndex`) to member seat ids. */
  unitMembers: Map<string, string[]>
  itemNames: Map<string, string>
  /** Seats with a phone on the table right now. */
  activeSeatIds: Set<string>
  /**
   * Seat id to recorded payments. Hosts see every seat; a guest phone sees
   * only its own seats (payments of others stay private).
   */
  paidCents: Map<string, number>
}

export type ActivityKind = 'joined' | 'took' | 'released' | 'shared' | 'paid'

export interface ActivityEvent {
  id: string
  at: number
  kind: ActivityKind
  seatId: string
  text: string
}

function itemIdOf(unitKeyValue: string): string {
  const separator = unitKeyValue.lastIndexOf(':')
  return separator === -1 ? unitKeyValue : unitKeyValue.slice(0, separator)
}

export function diffActivity(
  prev: ActivitySnapshot,
  next: ActivitySnapshot,
  labelOf: (seatId: string) => string,
  at: number,
): ActivityEvent[] {
  const events: ActivityEvent[] = []
  const push = (kind: ActivityKind, seatId: string, text: string) => {
    events.push({ id: `${at}:${events.length}`, at, kind, seatId, text })
  }

  for (const seatId of next.activeSeatIds) {
    if (!prev.activeSeatIds.has(seatId)) {
      push('joined', seatId, `${labelOf(seatId)} седна на масата`)
    }
  }

  const keys = new Set([...prev.unitMembers.keys(), ...next.unitMembers.keys()])
  for (const key of keys) {
    const before = prev.unitMembers.get(key) ?? []
    const after = next.unitMembers.get(key) ?? []
    const item =
      next.itemNames.get(itemIdOf(key)) ?? prev.itemNames.get(itemIdOf(key))
    if (!item) continue
    const added = after.filter((id) => !before.includes(id))
    const removed = before.filter((id) => !after.includes(id))
    if (added.length > 0 && after.length > 1) {
      const names = after.map(labelOf)
      push(
        'shared',
        added[0],
        `${names.slice(0, -1).join(', ')} и ${names.at(-1)} делят ${item}`,
      )
    } else {
      for (const id of added) push('took', id, `${labelOf(id)} взе ${item}`)
    }
    // A Unit deleted with its item line is not "returned" by anyone.
    if (next.itemNames.has(itemIdOf(key))) {
      for (const id of removed) {
        push('released', id, `${labelOf(id)} върна ${item}`)
      }
    }
  }

  for (const [seatId, cents] of next.paidCents) {
    if (cents > (prev.paidCents.get(seatId) ?? 0)) {
      push('paid', seatId, `${labelOf(seatId)}: платено`)
    }
  }

  return events
}
