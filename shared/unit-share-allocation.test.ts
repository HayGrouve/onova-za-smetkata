import { describe, expect, it } from 'vitest'
import { calculateParticipantBreakdown } from './bill-calculations'
import {
  resolveEffectiveUnitAssignees,
  splitLineTotal,
  splitUnitShareAmongAssignees,
  unitShareCentsForParticipant,
} from './unit-share-allocation'

describe('splitLineTotal', () => {
  it('assigns full amount to one person', () => {
    expect(splitLineTotal(1000, ['a'])).toEqual([{ id: 'a', cents: 1000 }])
  })

  it('splits evenly with remainder to first participants', () => {
    expect(splitLineTotal(100, ['a', 'b', 'c'])).toEqual([
      { id: 'a', cents: 34 },
      { id: 'b', cents: 33 },
      { id: 'c', cents: 33 },
    ])
  })
})

describe('splitUnitShareAmongAssignees', () => {
  it('orders assignees by participant sortOrder, not lexicographic id', () => {
    const participants = [
      { id: 'id_bbb', sortOrder: 0 },
      { id: 'id_aaa', sortOrder: 1 },
      { id: 'id_ccc', sortOrder: 2 },
    ]

    expect(
      splitUnitShareAmongAssignees(
        1000,
        ['id_aaa', 'id_bbb', 'id_ccc'],
        participants,
      ),
    ).toEqual([
      { id: 'id_bbb', cents: 334 },
      { id: 'id_aaa', cents: 333 },
      { id: 'id_ccc', cents: 333 },
    ])
  })
})

describe('resolveEffectiveUnitAssignees', () => {
  it('adds participant when joining an existing split', () => {
    expect(resolveEffectiveUnitAssignees(['p2'], 'p1', true)).toEqual([
      'p2',
      'p1',
    ])
  })

  it('defaults to solo participant when unit is empty', () => {
    expect(resolveEffectiveUnitAssignees([], 'p1', true)).toEqual(['p1'])
  })
})

describe('unitShareCentsForParticipant', () => {
  const participants = [
    { id: 'p1', sortOrder: 0 },
    { id: 'p2', sortOrder: 1 },
    { id: 'p3', sortOrder: 2 },
  ]

  it('returns full unit price when unclaimed solo', () => {
    expect(
      unitShareCentsForParticipant({
        unitPriceCents: 900,
        assigneeIds: [],
        participants,
        participantId: 'p1',
        joining: true,
      }),
    ).toBe(900)
  })

  it('previews join into 2-way split', () => {
    expect(
      unitShareCentsForParticipant({
        unitPriceCents: 900,
        assigneeIds: ['p2'],
        participants,
        participantId: 'p1',
        joining: true,
      }),
    ).toBe(450)
  })

  it('matches calculateParticipantBreakdown for committed assignments', () => {
    const breakdownInput = {
      participants,
      items: [{ id: 'i1', name: 'Salad', unitPriceCents: 1000, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'id_bbb', unitIndex: 0 },
        { itemId: 'i1', participantId: 'id_aaa', unitIndex: 0 },
      ],
      tipCents: 0,
    }
    const participantsByOrder = [
      { id: 'id_bbb', sortOrder: 0 },
      { id: 'id_aaa', sortOrder: 1 },
    ]

    for (const participantId of ['id_bbb', 'id_aaa']) {
      const preview = unitShareCentsForParticipant({
        unitPriceCents: 1000,
        assigneeIds: ['id_bbb', 'id_aaa'],
        participants: participantsByOrder,
        participantId,
        joining: false,
      })
      const breakdown = calculateParticipantBreakdown(
        { ...breakdownInput, participants: participantsByOrder },
        participantId,
      )
      expect(preview).toBe(breakdown.lines[0]?.amountCents)
    }
  })
})
