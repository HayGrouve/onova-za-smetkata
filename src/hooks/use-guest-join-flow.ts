import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  canResume,
  takenSeats,
} from '#/lib/guest-flow-session/guest-flow-session.ts'
import type { FlowOutcome } from '#/lib/guest-flow-session/guest-flow-session.ts'
import { useActiveSeats } from '#/hooks/use-active-seats.ts'
import { localSeatStore } from '#/lib/guest-flow-session/local-seat-store.ts'
import { useGuestFlowSession } from '#/lib/guest-flow-session/use-guest-flow-session.ts'

/** The join page: resume this phone's seat, or let the Guest pick one. */
export function useGuestJoinFlow(billId: Id<'bills'>, shareToken: string) {
  const navigate = useNavigate()
  const flow = useGuestFlowSession(billId)
  const data = useQuery(api.bills.getForGuest, { billId, shareToken })
  const activeSeats = useActiveSeats(billId, shareToken)
  const [joining, setJoining] = useState(false)
  const [resuming, setResuming] = useState(() =>
    canResume(localSeatStore.read(billId), shareToken),
  )
  /**
   * Resume once per visit. The seat list updates as soon as the resume claim
   * lands; re-running then would cancel it and claim again, so every page
   * load used to spend several claims of the per-phone rate limit.
   */
  const resumeStartedRef = useRef(false)
  const unmountedRef = useRef(false)
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])

  const storedSession = useMemo(
    () => localSeatStore.read(billId),
    [billId, activeSeats],
  )
  const taken = useMemo(
    () => takenSeats(activeSeats, storedSession?.participantId),
    [activeSeats, storedSession?.participantId],
  )
  const gate: 'loading' | 'ready' =
    data === undefined || activeSeats === undefined || resuming
      ? 'loading'
      : 'ready'

  function follow(outcome: FlowOutcome) {
    if (outcome.to === 'claim') {
      // Replace: Back from the claim page must not land on join, which would
      // resume and bounce forward again.
      void navigate({
        to: '/bills/$billId/claim',
        params: { billId },
        search: { t: shareToken },
        replace: true,
      })
    } else if (outcome.message) {
      toast.error(outcome.message)
    }
  }

  useEffect(() => {
    if (data === undefined || activeSeats === undefined) return
    if (resumeStartedRef.current) return
    resumeStartedRef.current = true
    void flow.resume(shareToken).then((outcome) => {
      if (unmountedRef.current) return
      if (outcome) follow(outcome)
      if (outcome?.to !== 'claim') setResuming(false)
    })
  }, [data, activeSeats, flow, navigate, shareToken])

  /** Take the Guest's own seat and open the claim page straight away. */
  async function join(participantId: Id<'participants'>) {
    if (taken.has(participantId)) return
    setJoining(true)
    try {
      follow(await flow.pickSeat(shareToken, participantId))
    } finally {
      setJoining(false)
    }
  }

  return {
    gate,
    data,
    takenSeats: taken,
    joining,
    join,
  }
}
