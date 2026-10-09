import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { sameActiveSeats } from '#/lib/guest-flow-session/guest-flow-session.ts'

/**
 * Seats Guest phones hold on the bill, live. The array keeps its identity
 * until a seat is really taken, changed or freed, so the Live receipt and
 * everything memoized on it rebuild only then. Skipped without a share link.
 */
export function useActiveSeats(billId: Id<'bills'>, shareToken?: string) {
  const seats = useQuery(
    api.guestSessions.listActiveForBill,
    shareToken ? { billId, shareToken } : 'skip',
  )
  const [stable, setStable] = useState(seats)
  if (sameActiveSeats(stable, seats)) return stable
  setStable(seats)
  return seats
}
