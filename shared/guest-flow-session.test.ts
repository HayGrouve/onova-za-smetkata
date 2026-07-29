import { describe, expect, it } from 'vitest'
import {
  buildTakenParticipantIds,
  mapGuestBillToClaimSessionInput,
  planIdentitySwitchRecovery,
  planSessionLostRecovery,
  resolveClaimPageGate,
  resolveEffectiveShareToken,
  resolveJoinPageGate,
  shouldAttemptJoinResume,
} from './guest-flow-session'
import type {
  GuestFlowBillData,
  StoredGuestSessionRef,
} from './guest-flow-session'

const storedSession: StoredGuestSessionRef = {
  billId: 'bill-1',
  participantId: 'participant-1',
  sessionToken: 'session-token',
  shareToken: 'share-token',
}

const billData: GuestFlowBillData = {
  bill: {
    tipCents: 100,
    status: 'draft',
    restaurantName: 'Test',
    date: Date.now(),
  },
  hostParticipantId: 'host-1',
  participants: [
    { _id: 'participant-1', name: 'Alice', sortOrder: 0 },
    { _id: 'participant-2', name: 'Bob', sortOrder: 1 },
  ],
  items: [
    {
      _id: 'item-1',
      name: 'Salad',
      quantity: 1,
      sortOrder: 0,
      unitPriceCents: 500,
    },
  ],
  assignments: [
    {
      itemId: 'item-1',
      participantId: 'participant-1',
      unitIndex: 0,
    },
  ],
  myPayments: [{ participantId: 'participant-1', amountCents: 0 }],
}

describe('buildTakenParticipantIds', () => {
  it('returns empty set when sessions are undefined', () => {
    expect(buildTakenParticipantIds(undefined, 'self')).toEqual(new Set())
  })

  it('returns empty set when no active sessions', () => {
    expect(buildTakenParticipantIds([], 'self')).toEqual(new Set())
  })

  it('marks another participant as taken', () => {
    expect(
      buildTakenParticipantIds([{ participantId: 'alice' }], undefined),
    ).toEqual(new Set(['alice']))
  })

  it('excludes the viewer own session', () => {
    expect(
      buildTakenParticipantIds(
        [{ participantId: 'self' }, { participantId: 'bob' }],
        'self',
      ),
    ).toEqual(new Set(['bob']))
  })

  it('collects multiple taken seats', () => {
    expect(
      buildTakenParticipantIds(
        [
          { participantId: 'alice' },
          { participantId: 'bob' },
          { participantId: 'carol' },
        ],
        'alice',
      ),
    ).toEqual(new Set(['bob', 'carol']))
  })
})

describe('shouldAttemptJoinResume', () => {
  it('returns false when there is no stored session', () => {
    expect(shouldAttemptJoinResume(null, 'share-token')).toBe(false)
  })

  it('returns false when share tokens mismatch', () => {
    expect(
      shouldAttemptJoinResume(
        { ...storedSession, shareToken: 'other-token' },
        'share-token',
      ),
    ).toBe(false)
  })

  it('returns true when stored session matches url share token', () => {
    expect(shouldAttemptJoinResume(storedSession, 'share-token')).toBe(true)
  })
})

describe('resolveJoinPageGate', () => {
  it('returns loading while bill data is undefined', () => {
    expect(
      resolveJoinPageGate({
        billData: undefined,
        activeSessions: [],
        resuming: false,
      }),
    ).toBe('loading')
  })

  it('returns loading while resuming', () => {
    expect(
      resolveJoinPageGate({
        billData: billData,
        activeSessions: [],
        resuming: true,
      }),
    ).toBe('loading')
  })

  it('returns ready when data is loaded and not resuming', () => {
    expect(
      resolveJoinPageGate({
        billData: billData,
        activeSessions: [],
        resuming: false,
      }),
    ).toBe('ready')
  })
})

describe('resolveEffectiveShareToken', () => {
  it('prefers stored session share token', () => {
    expect(resolveEffectiveShareToken(storedSession, 'url-token')).toBe(
      'share-token',
    )
  })

  it('falls back to url token', () => {
    expect(resolveEffectiveShareToken(null, 'url-token')).toBe('url-token')
  })
})

describe('resolveClaimPageGate', () => {
  it('redirects when share token is missing', () => {
    expect(
      resolveClaimPageGate({
        shareToken: '',
        storedSession,
        billData: undefined,
      }),
    ).toEqual({ status: 'redirect-join', reason: 'missing-token' })
  })

  it('returns loading while bill data is undefined', () => {
    expect(
      resolveClaimPageGate({
        shareToken: 'share-token',
        storedSession,
        billData: undefined,
      }),
    ).toEqual({ status: 'loading' })
  })

  it('redirects when session is missing after bill load', () => {
    expect(
      resolveClaimPageGate({
        shareToken: 'share-token',
        storedSession: null,
        billData,
      }),
    ).toEqual({ status: 'redirect-join', reason: 'missing-session' })
  })

  it('redirects when participant is not on the bill', () => {
    expect(
      resolveClaimPageGate({
        shareToken: 'share-token',
        storedSession: { ...storedSession, participantId: 'missing' },
        billData,
      }),
    ).toEqual({ status: 'redirect-join', reason: 'participant-not-found' })
  })

  it('returns ready when session and participant are valid', () => {
    expect(
      resolveClaimPageGate({
        shareToken: 'share-token',
        storedSession,
        billData,
      }),
    ).toEqual({
      status: 'ready',
      shareToken: 'share-token',
      storedSession,
      participantId: 'participant-1',
    })
  })
})

describe('mapGuestBillToClaimSessionInput', () => {
  it('maps convex guest bill docs to guest claim session input', () => {
    expect(mapGuestBillToClaimSessionInput(billData)).toEqual({
      items: [
        {
          id: 'item-1',
          name: 'Salad',
          quantity: 1,
          sortOrder: 0,
        },
      ],
      assignments: [
        {
          itemId: 'item-1',
          participantId: 'participant-1',
          unitIndex: 0,
        },
      ],
      billRelations: {
        participants: billData.participants,
        items: billData.items,
        assignments: billData.assignments,
        payments: billData.myPayments,
      },
      billContext: {
        tipCents: 100,
        hostParticipantId: 'host-1',
      },
    })
  })
})

describe('planSessionLostRecovery', () => {
  it('always clears storage and redirects with toast', () => {
    expect(
      planSessionLostRecovery({
        shareToken: 'share-token',
        storedSession,
      }),
    ).toEqual({
      clearStorage: true,
      releaseSession: true,
      toastMessage: expect.any(String),
      redirectShareToken: 'share-token',
    })
  })

  it('skips release when session is missing', () => {
    expect(
      planSessionLostRecovery({
        shareToken: 'share-token',
        storedSession: null,
      }),
    ).toMatchObject({
      releaseSession: false,
    })
  })
})

describe('planIdentitySwitchRecovery', () => {
  it('clears storage and requests release without toast', () => {
    expect(planIdentitySwitchRecovery({ shareToken: 'share-token' })).toEqual({
      clearStorage: true,
      releaseSession: true,
      redirectShareToken: 'share-token',
    })
  })
})
