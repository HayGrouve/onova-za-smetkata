import { useMutation } from 'convex/react'
import { useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { createGuestFlowSession } from './guest-flow-session.ts'
import type { GuestFlowSession } from './guest-flow-session.ts'
import {
  createGuestSessionToken,
  getOrCreateGuestDeviceId,
  localSeatStore,
} from './local-seat-store.ts'

/** The Guest flow session for one bill, on this phone's storage and Convex. */
export function useGuestFlowSession(billId: Id<'bills'>): GuestFlowSession {
  const claim = useMutation(api.guestSessions.claim)
  const release = useMutation(api.guestSessions.release)
  return useMemo(
    () =>
      createGuestFlowSession({
        billId,
        store: localSeatStore,
        server: {
          claim: (args) =>
            claim({
              ...args,
              billId: args.billId as Id<'bills'>,
              participantId: args.participantId as Id<'participants'>,
              coveredParticipantIds: args.coveredParticipantIds as
                Id<'participants'>[] | undefined,
            }),
          release: (args) =>
            release({ ...args, billId: args.billId as Id<'bills'> }),
        },
        newSessionToken: createGuestSessionToken,
        deviceId: getOrCreateGuestDeviceId,
      }),
    [billId, claim, release],
  )
}
