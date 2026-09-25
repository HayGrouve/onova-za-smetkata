import { describe, expect, it } from 'vitest'
import { GUEST_FLOW_MESSAGES } from './guest-flow-messages'
import {
  sessionSeatIds,
  validateCoveredSeatSelection,
} from './guest-seat-selection'

const base = {
  ownParticipantId: 'me',
  billParticipantIds: ['host', 'me', 'partner', 'friend'],
  hostParticipantId: 'host',
  takenByOtherSessions: new Set<string>(['friend']),
}

describe('validateCoveredSeatSelection', () => {
  it('accepts free guest seats and drops duplicates', () => {
    expect(
      validateCoveredSeatSelection({
        ...base,
        coveredParticipantIds: ['partner', 'partner'],
      }),
    ).toEqual({ ok: true, coveredParticipantIds: ['partner'] })
  })

  it('accepts an empty selection', () => {
    expect(
      validateCoveredSeatSelection({ ...base, coveredParticipantIds: [] }),
    ).toEqual({ ok: true, coveredParticipantIds: [] })
  })

  it('rejects the own seat', () => {
    expect(
      validateCoveredSeatSelection({ ...base, coveredParticipantIds: ['me'] }),
    ).toEqual({ ok: false, message: GUEST_FLOW_MESSAGES.coveredSeatIsOwn })
  })

  it('rejects the Host seat', () => {
    expect(
      validateCoveredSeatSelection({
        ...base,
        coveredParticipantIds: ['host'],
      }),
    ).toEqual({ ok: false, message: GUEST_FLOW_MESSAGES.coveredSeatIsHost })
  })

  it('rejects seats from another bill', () => {
    expect(
      validateCoveredSeatSelection({
        ...base,
        coveredParticipantIds: ['stranger'],
      }),
    ).toEqual({ ok: false, message: GUEST_FLOW_MESSAGES.participantNotOnBill })
  })

  it('rejects seats another phone holds', () => {
    expect(
      validateCoveredSeatSelection({
        ...base,
        coveredParticipantIds: ['friend'],
      }),
    ).toEqual({ ok: false, message: GUEST_FLOW_MESSAGES.coveredSeatTaken })
  })
})

describe('sessionSeatIds', () => {
  it('lists the own seat first', () => {
    expect(
      sessionSeatIds({
        participantId: 'me',
        coveredParticipantIds: ['partner', 'me'],
      }),
    ).toEqual(['me', 'partner'])
  })

  it('handles sessions without Covered seats', () => {
    expect(sessionSeatIds({ participantId: 'me' })).toEqual(['me'])
  })
})
