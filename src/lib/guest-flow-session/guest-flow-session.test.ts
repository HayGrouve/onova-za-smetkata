import { describe, expect, it, vi } from 'vitest'
import { GUEST_FLOW_MESSAGES } from '../../../shared/guest-flow-messages.ts'
import {
  claimPageGate,
  createGuestFlowSession,
  mySeatIds,
  takenSeats,
} from './guest-flow-session.ts'
import type {
  SeatServer,
  SeatStore,
  StoredGuestSession,
} from './guest-flow-session.ts'

const BILL = 'bill-1'
const LINK = 'share-link'

/** The server's answer when it refuses on purpose (`ConvexError`). */
const refusal = (reason: string) =>
  Object.assign(new Error(reason), { data: reason })

function memoryStore(initial: StoredGuestSession | null = null): SeatStore & {
  current: () => StoredGuestSession | null
} {
  let saved = initial
  return {
    read: (billId) => (saved?.billId === billId ? saved : null),
    write: (session) => {
      saved = session
    },
    clear: (billId) => {
      if (saved?.billId === billId) saved = null
    },
    current: () => saved,
  }
}

/** A server that answers each claim from `answers` in turn (ok when empty). */
function fakeServer(...answers: Array<Error | 'ok'>) {
  const claims: Array<Parameters<SeatServer['claim']>[0]> = []
  const released: string[] = []
  const server: SeatServer = {
    claim: (args) => {
      claims.push(args)
      const answer = answers.shift() ?? 'ok'
      return answer === 'ok' ? Promise.resolve() : Promise.reject(answer)
    },
    release: (args) => {
      released.push(args.sessionToken)
      return Promise.resolve()
    },
  }
  return { server, claims, released }
}

function flowWith(store: SeatStore, server: SeatServer) {
  return createGuestFlowSession({
    billId: BILL,
    store,
    server,
    newSessionToken: () => 'new-token',
    deviceId: () => 'device',
  })
}

const aniOnThisPhone: StoredGuestSession = {
  billId: BILL,
  participantId: 'ani',
  sessionToken: 'ani-token',
  shareToken: LINK,
  coveredParticipantIds: ['bobi'],
}

describe('opening the join link again', () => {
  it('takes the same seat back, Covered seats too, and goes to claiming', async () => {
    const store = memoryStore(aniOnThisPhone)
    const { server, claims } = fakeServer()

    expect(await flowWith(store, server).resume(LINK)).toEqual({ to: 'claim' })
    expect(claims).toEqual([
      expect.objectContaining({
        participantId: 'ani',
        sessionToken: 'ani-token',
        coveredParticipantIds: ['bobi'],
      }),
    ])
  })

  it('keeps the own seat when a Covered seat went to someone else', async () => {
    const store = memoryStore(aniOnThisPhone)
    const { server, claims } = fakeServer(
      refusal(GUEST_FLOW_MESSAGES.coveredSeatTaken),
    )

    expect(await flowWith(store, server).resume(LINK)).toEqual({ to: 'claim' })
    expect(claims.map((claim) => claim.coveredParticipantIds)).toEqual([
      ['bobi'],
      [],
    ])
    expect(store.current()?.coveredParticipantIds).toBeUndefined()
  })

  it('a rate limit keeps the session and says why, without retrying', async () => {
    const store = memoryStore(aniOnThisPhone)
    const { server, claims } = fakeServer(
      refusal(GUEST_FLOW_MESSAGES.claimRateLimitActor),
    )

    expect(await flowWith(store, server).resume(LINK)).toEqual({
      to: 'picker',
      message: GUEST_FLOW_MESSAGES.claimRateLimitActor,
    })
    expect(claims).toHaveLength(1)
    expect(store.current()).toEqual(aniOnThisPhone)
  })

  it('a seat that is gone for good is forgotten', async () => {
    const store = memoryStore({ ...aniOnThisPhone, coveredParticipantIds: [] })
    const { server } = fakeServer(refusal(GUEST_FLOW_MESSAGES.nameTaken))

    expect(await flowWith(store, server).resume(LINK)).toEqual({
      to: 'picker',
      message: GUEST_FLOW_MESSAGES.sessionLostRedirect,
    })
    expect(store.current()).toBeNull()
  })

  it('a dropped connection keeps the session for a tap to retry', async () => {
    const store = memoryStore(aniOnThisPhone)
    const { server } = fakeServer(new Error('fetch failed'), new Error('again'))

    const outcome = await flowWith(store, server).resume(LINK)

    expect(outcome?.to).toBe('picker')
    expect(store.current()).toEqual(aniOnThisPhone)
  })

  it('has nothing to resume from another link or another bill', async () => {
    const { server, claims } = fakeServer()

    expect(
      await flowWith(memoryStore(aniOnThisPhone), server).resume('rotated'),
    ).toBeNull()
    expect(
      await flowWith(
        memoryStore({ ...aniOnThisPhone, billId: 'other-bill' }),
        server,
      ).resume(LINK),
    ).toBeNull()
    expect(claims).toEqual([])
  })
})

describe('picking a seat', () => {
  it('a new seat gets a new session and starts without Covered seats', async () => {
    const store = memoryStore(aniOnThisPhone)
    const { server, claims } = fakeServer()

    expect(await flowWith(store, server).pickSeat(LINK, 'vicky')).toEqual({
      to: 'claim',
    })
    expect(claims[0]).toMatchObject({
      sessionToken: 'new-token',
      coveredParticipantIds: [],
    })
    expect(store.current()).toEqual({
      billId: BILL,
      participantId: 'vicky',
      sessionToken: 'new-token',
      shareToken: LINK,
    })
  })

  it('the own seat again reuses this phone’s session and keeps Covered seats', async () => {
    const store = memoryStore(aniOnThisPhone)
    const { server, claims } = fakeServer()

    await flowWith(store, server).pickSeat(LINK, 'ani')

    expect(claims[0]).toMatchObject({
      sessionToken: 'ani-token',
      coveredParticipantIds: undefined,
    })
    expect(store.current()).toEqual(aniOnThisPhone)
  })

  it('a refused pick leaves the phone as it was and says why', async () => {
    const store = memoryStore(aniOnThisPhone)
    const { server } = fakeServer(refusal(GUEST_FLOW_MESSAGES.nameTaken))

    expect(await flowWith(store, server).pickSeat(LINK, 'vicky')).toEqual({
      to: 'picker',
      message: GUEST_FLOW_MESSAGES.nameTaken,
    })
    expect(store.current()).toEqual(aniOnThisPhone)
  })
})

describe('on the claim and pay pages', () => {
  const bill = { participants: [{ _id: 'ani' }, { _id: 'bobi' }] }

  it('waits for the bill, then stands ready on the stored link', () => {
    const session = { ...aniOnThisPhone, shareToken: 'stored-link' }
    expect(
      claimPageGate({ session, shareTokenFromUrl: LINK, billData: undefined }),
    ).toEqual({ status: 'loading' })
    expect(
      claimPageGate({ session, shareTokenFromUrl: LINK, billData: bill }),
    ).toEqual({
      status: 'ready',
      shareToken: 'stored-link',
      session,
      participantId: 'ani',
    })
  })

  it('sends a phone without a link or a session back to join', () => {
    expect(
      claimPageGate({ session: null, shareTokenFromUrl: '', billData: bill }),
    ).toEqual({ status: 'leave', reason: 'missing-link' })
    expect(
      claimPageGate({ session: null, shareTokenFromUrl: LINK, billData: bill }),
    ).toEqual({ status: 'leave', reason: 'missing-session' })
  })

  it('a seat the Host removed is forgotten, with a reason', () => {
    const store = memoryStore(aniOnThisPhone)
    const gate = claimPageGate({
      session: aniOnThisPhone,
      shareTokenFromUrl: LINK,
      billData: { participants: [{ _id: 'bobi' }] },
    })
    expect(gate).toEqual({ status: 'leave', reason: 'seat-removed' })

    expect(
      flowWith(store, fakeServer().server).leaveClaimPage('seat-removed', LINK),
    ).toEqual({
      to: 'join',
      shareToken: LINK,
      message: GUEST_FLOW_MESSAGES.seatRemoved,
    })
    expect(store.current()).toBeNull()
  })

  it('a lapsed session hands over to the join page with the seat kept', () => {
    const store = memoryStore(aniOnThisPhone)

    expect(flowWith(store, fakeServer().server).sessionLost(LINK)).toEqual({
      to: 'join',
      shareToken: LINK,
    })
    expect(store.current()).toEqual(aniOnThisPhone)
  })

  it('„Не съм …“ gives the seat back and forgets it', () => {
    const store = memoryStore(aniOnThisPhone)
    const { server, released } = fakeServer()

    expect(flowWith(store, server).switchIdentity(aniOnThisPhone)).toEqual({
      to: 'join',
      shareToken: LINK,
    })
    expect(released).toEqual(['ani-token'])
    expect(store.current()).toBeNull()
  })

  it('a failed release still lets the Guest pick again', () => {
    const store = memoryStore(aniOnThisPhone)
    const server: SeatServer = {
      claim: vi.fn(),
      release: () => Promise.reject(new Error('offline')),
    }

    expect(flowWith(store, server).switchIdentity(aniOnThisPhone).to).toBe(
      'join',
    )
    expect(store.current()).toBeNull()
  })

  it('remembers changed Covered seats for the next resume', () => {
    const store = memoryStore(aniOnThisPhone)
    flowWith(store, fakeServer().server).rememberCoveredSeats(['vicky'])
    expect(store.current()?.coveredParticipantIds).toEqual(['vicky'])
  })
})

describe('seats other phones hold', () => {
  it('leaves out this phone’s own seat and its Covered seats', () => {
    expect(
      takenSeats(
        [
          { participantId: 'self' },
          { participantId: 'partner', heldByParticipantId: 'self' },
          { participantId: 'bob' },
        ],
        'self',
      ),
    ).toEqual(new Map([['bob', null]]))
  })

  it('says who holds a Covered seat', () => {
    expect(
      takenSeats(
        [
          { participantId: 'alice' },
          { participantId: 'bob', heldByParticipantId: 'alice' },
        ],
        'carol',
      ),
    ).toEqual(
      new Map([
        ['alice', null],
        ['bob', 'alice'],
      ]),
    )
    expect(takenSeats(undefined, 'self')).toEqual(new Map())
  })
})

describe('seats this phone handles', () => {
  it('own seat first, without seats no longer on the bill', () => {
    const data = {
      participants: [{ _id: 'ani' }, { _id: 'bobi' }],
      mySeatIds: ['bobi', 'gone', 'ani'],
    }
    expect(mySeatIds(data, 'ani')).toEqual(['ani', 'bobi'])
    expect(mySeatIds({ participants: data.participants }, 'ani')).toEqual([
      'ani',
    ])
  })
})
