/**
 * PROTOTYPE — simulated other phones at the table. While enabled, joined
 * guests (not the viewer's seats, not the host) claim free Units and later
 * report payments, so live/multiplayer UI can be evaluated.
 */
import { useEffect, useRef } from 'react'
import { useProto } from './store.tsx'

export function useLiveTable(enabled: boolean, intervalMs = 5200) {
  const store = useProto()
  const ref = useRef(store)
  ref.current = store

  useEffect(() => {
    if (!enabled) return
    let tick = 0
    const id = window.setInterval(() => {
      tick += 1
      const { derived, mySeatIds, dispatch, state } = ref.current
      if (state.bill.status === 'final') return
      const remote = derived.guests.filter(
        (g) => !mySeatIds.includes(g.participantId),
      )
      // Боби opens the link after a while.
      const notJoined = remote.find((g) => !g.joined)
      if (notJoined && tick % 4 === 2) {
        dispatch({ type: 'remoteJoin', participantId: notJoined.participantId })
        return
      }
      const joined = remote.filter((g) => g.joined)
      if (joined.length === 0) return
      const actor = joined[tick % joined.length]
      const freeGroups = derived.groups.filter(
        (g) => derived.seatView(g.key, actor.participantId).freeUnits.length > 0,
      )
      // Leave some Units for the viewer: only claim while > 4 are free.
      if (freeGroups.length > 0 && derived.unclaimedUnits > 4) {
        const group = freeGroups[(tick * 7) % freeGroups.length]
        dispatch({ type: 'takeUnit', groupKey: group.key, participantId: actor.participantId })
        return
      }
      const payer = joined.find(
        (g) => g.remainingCents > 0 && g.pendingCents === 0 && g.claimedUnits > 0,
      )
      if (payer && tick % 3 === 0) {
        dispatch({ type: 'reportPaid', participantIds: [payer.participantId], by: payer.participantId })
      }
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs])
}
