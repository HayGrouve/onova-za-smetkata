import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { UnitRef } from '../../shared/claim-groups'

/**
 * Claim-page actions for one seat. Every action resolves to `true` on success;
 * errors surface as a toast. `busy` blocks double taps while a call is in flight.
 */
export function useClaimActions({
  seatId,
  sessionToken,
  onChanged,
}: {
  seatId: Id<'participants'>
  sessionToken?: string
  onChanged?: () => void
}) {
  const takeUnit = useMutation(api.assignments.takeUnit)
  const releaseUnit = useMutation(api.assignments.releaseUnit)
  const shareUnit = useMutation(api.assignments.shareUnit)
  const joinUnit = useMutation(api.assignments.joinUnit)
  const leaveUnit = useMutation(api.assignments.leaveUnit)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    try {
      await action()
      onChanged?.()
      return true
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
      return false
    } finally {
      setBusy(false)
    }
  }

  function asItemIds(itemIds: string[]) {
    return itemIds as Id<'items'>[]
  }

  function asUnit(unit: UnitRef) {
    return { itemId: unit.itemId as Id<'items'>, unitIndex: unit.unitIndex }
  }

  return {
    busy,
    take: (itemIds: string[]) =>
      run(() =>
        takeUnit({
          itemIds: asItemIds(itemIds),
          participantId: seatId,
          sessionToken,
        }),
      ),
    release: (itemIds: string[]) =>
      run(() =>
        releaseUnit({
          itemIds: asItemIds(itemIds),
          participantId: seatId,
          sessionToken,
        }),
      ),
    share: (itemIds: string[], withIds: string[], unit?: UnitRef) =>
      run(() =>
        shareUnit({
          itemIds: asItemIds(itemIds),
          participantId: seatId,
          withParticipantIds: withIds as Id<'participants'>[],
          unit: unit ? asUnit(unit) : undefined,
          sessionToken,
        }),
      ),
    join: (unit: UnitRef) =>
      run(() =>
        joinUnit({ ...asUnit(unit), participantId: seatId, sessionToken }),
      ),
    leave: (unit: UnitRef) =>
      run(() =>
        leaveUnit({ ...asUnit(unit), participantId: seatId, sessionToken }),
      ),
  }
}
