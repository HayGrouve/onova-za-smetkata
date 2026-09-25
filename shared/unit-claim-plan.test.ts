import { describe, expect, it } from 'vitest'
import { CLAIM_MESSAGES } from './claim-messages'
import { planReleaseUnit, planShareUnit, planTakeUnit } from './unit-claim-plan'

const units = [
  { itemId: 'i1', unitIndex: 0 },
  { itemId: 'i1', unitIndex: 1 },
  { itemId: 'i2', unitIndex: 0 },
]

describe('planTakeUnit', () => {
  it('takes the first Unit nobody has', () => {
    expect(
      planTakeUnit({
        units,
        assignments: [{ itemId: 'i1', unitIndex: 0, participantId: 'b' }],
      }),
    ).toEqual({ ok: true, unit: { itemId: 'i1', unitIndex: 1 } })
  })

  it('never joins a Unit someone already has', () => {
    const result = planTakeUnit({
      units,
      assignments: units.map((unit) => ({ ...unit, participantId: 'b' })),
    })
    expect(result).toEqual({ ok: false, message: CLAIM_MESSAGES.noFreeUnits })
  })
})

describe('planReleaseUnit', () => {
  it('releases the last Unit the seat holds alone', () => {
    expect(
      planReleaseUnit({
        units,
        participantId: 'a',
        assignments: [
          { itemId: 'i1', unitIndex: 0, participantId: 'a' },
          { itemId: 'i1', unitIndex: 1, participantId: 'a' },
          { itemId: 'i2', unitIndex: 0, participantId: 'a' },
          { itemId: 'i2', unitIndex: 0, participantId: 'b' },
        ],
      }),
    ).toEqual({ ok: true, unit: { itemId: 'i1', unitIndex: 1 } })
  })

  it('does not touch shared Units', () => {
    expect(
      planReleaseUnit({
        units,
        participantId: 'a',
        assignments: [
          { itemId: 'i1', unitIndex: 0, participantId: 'a' },
          { itemId: 'i1', unitIndex: 0, participantId: 'b' },
        ],
      }),
    ).toEqual({ ok: false, message: CLAIM_MESSAGES.noSoloUnitToRelease })
  })
})

describe('planShareUnit', () => {
  it('shares the seat’s first solo Unit when no Unit is given', () => {
    expect(
      planShareUnit({
        units,
        actorId: 'a',
        withParticipantIds: ['b'],
        assignments: [
          { itemId: 'i1', unitIndex: 0, participantId: 'c' },
          { itemId: 'i1', unitIndex: 1, participantId: 'a' },
        ],
      }),
    ).toEqual({
      ok: true,
      unit: { itemId: 'i1', unitIndex: 1 },
      add: ['b'],
      remove: [],
    })
  })

  it('takes a free Unit and shares it when the seat has none', () => {
    expect(
      planShareUnit({
        units,
        actorId: 'a',
        withParticipantIds: ['b', 'c'],
        assignments: [{ itemId: 'i1', unitIndex: 0, participantId: 'c' }],
      }),
    ).toEqual({
      ok: true,
      unit: { itemId: 'i1', unitIndex: 1 },
      add: ['a', 'b', 'c'],
      remove: [],
    })
  })

  it('requires someone to share with when no Unit is given', () => {
    expect(
      planShareUnit({
        units,
        actorId: 'a',
        withParticipantIds: ['a'],
        assignments: [],
      }),
    ).toEqual({ ok: false, message: CLAIM_MESSAGES.noShareTargets })
  })

  it('fails when nothing is free and the seat holds no solo Unit', () => {
    expect(
      planShareUnit({
        units: [{ itemId: 'i1', unitIndex: 0 }],
        actorId: 'a',
        withParticipantIds: ['b'],
        assignments: [{ itemId: 'i1', unitIndex: 0, participantId: 'c' }],
      }),
    ).toEqual({ ok: false, message: CLAIM_MESSAGES.noFreeUnits })
  })

  it('rewrites the co-members of a given Unit the seat is on', () => {
    expect(
      planShareUnit({
        units,
        actorId: 'a',
        unit: { itemId: 'i1', unitIndex: 0 },
        withParticipantIds: ['c'],
        assignments: [
          { itemId: 'i1', unitIndex: 0, participantId: 'a' },
          { itemId: 'i1', unitIndex: 0, participantId: 'b' },
        ],
      }),
    ).toEqual({
      ok: true,
      unit: { itemId: 'i1', unitIndex: 0 },
      add: ['c'],
      remove: ['b'],
    })
  })

  it('stops sharing when a given Unit gets an empty list', () => {
    expect(
      planShareUnit({
        units,
        actorId: 'a',
        unit: { itemId: 'i1', unitIndex: 0 },
        withParticipantIds: [],
        assignments: [
          { itemId: 'i1', unitIndex: 0, participantId: 'a' },
          { itemId: 'i1', unitIndex: 0, participantId: 'b' },
        ],
      }),
    ).toEqual({
      ok: true,
      unit: { itemId: 'i1', unitIndex: 0 },
      add: [],
      remove: ['b'],
    })
  })

  it('refuses to edit a Unit the seat is not on', () => {
    expect(
      planShareUnit({
        units,
        actorId: 'a',
        unit: { itemId: 'i1', unitIndex: 0 },
        withParticipantIds: ['c'],
        assignments: [{ itemId: 'i1', unitIndex: 0, participantId: 'b' }],
      }),
    ).toEqual({ ok: false, message: CLAIM_MESSAGES.notOnUnit })
  })

  it('refuses a Unit outside the group', () => {
    expect(
      planShareUnit({
        units,
        actorId: 'a',
        unit: { itemId: 'other', unitIndex: 0 },
        withParticipantIds: ['c'],
        assignments: [],
      }),
    ).toEqual({ ok: false, message: CLAIM_MESSAGES.unitNotInGroup })
  })
})
