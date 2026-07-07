import { useMutation } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { StoredGuestSession } from '#/lib/guest-participant-session.ts'

const HEARTBEAT_INTERVAL_MS = 30_000

export function useGuestSessionHeartbeat(
  session: StoredGuestSession | null,
  onSessionLost: () => void,
) {
  const heartbeat = useMutation(api.guestSessions.heartbeat)

  useEffect(() => {
    if (!session) return

    let cancelled = false

    async function ping() {
      try {
        await heartbeat({
          billId: session.billId as Id<'bills'>,
          participantId: session.participantId as Id<'participants'>,
          sessionToken: session.sessionToken,
        })
      } catch {
        if (!cancelled) onSessionLost()
      }
    }

    void ping()
    const intervalId = window.setInterval(() => {
      void ping()
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [session, heartbeat, onSessionLost])
}
