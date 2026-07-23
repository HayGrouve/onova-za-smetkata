import { describe, expect, it } from 'vitest'
import { buildTakenParticipantIds } from './join-taken-seats.ts'

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
