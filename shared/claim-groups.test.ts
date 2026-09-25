import { describe, expect, it } from 'vitest'
import { calculateParticipantBreakdown } from './bill-calculations'
import {
  buildClaimGroupSeatView,
  groupClaimItems,
  normalizeItemName,
} from './claim-groups'

const participants = [
  { id: 'a', sortOrder: 0 },
  { id: 'b', sortOrder: 1 },
  { id: 'c', sortOrder: 2 },
]

function item(
  id: string,
  name: string,
  unitPriceCents: number,
  quantity: number,
  sortOrder: number,
) {
  return { id, name, unitPriceCents, quantity, sortOrder }
}

describe('normalizeItemName', () => {
  it('trims, collapses spaces, and ignores case', () => {
    expect(normalizeItemName('  Бира   Загорка ')).toBe('бира загорка')
    expect(normalizeItemName('БИРА')).toBe(normalizeItemName('бира'))
  })
})

describe('groupClaimItems', () => {
  it('folds identical lines (same name and unit price) into one group', () => {
    const groups = groupClaimItems([
      item('i1', 'Бира', 150, 1, 0),
      item('i2', 'Салата', 500, 1, 1),
      item('i3', 'бира ', 150, 2, 2),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      name: 'Бира',
      unitPriceCents: 150,
      itemIds: ['i1', 'i3'],
      sortOrder: 0,
    })
    expect(groups[0].units).toEqual([
      { itemId: 'i1', unitIndex: 0 },
      { itemId: 'i3', unitIndex: 0 },
      { itemId: 'i3', unitIndex: 1 },
    ])
    expect(groups[1].itemIds).toEqual(['i2'])
  })

  it('keeps same-name lines with different prices apart', () => {
    const groups = groupClaimItems([
      item('i1', 'Бира', 150, 1, 0),
      item('i2', 'Бира', 250, 1, 1),
    ])
    expect(groups.map((group) => group.itemIds)).toEqual([['i1'], ['i2']])
  })

  it('orders groups and their units by item sortOrder', () => {
    const groups = groupClaimItems([
      item('late', 'Бира', 150, 1, 5),
      item('early', 'Бира', 150, 1, 1),
      item('mid', 'Вода', 100, 1, 3),
    ])
    expect(groups.map((group) => group.itemIds)).toEqual([
      ['early', 'late'],
      ['mid'],
    ])
  })
})

describe('buildClaimGroupSeatView', () => {
  const [beer] = groupClaimItems([item('beer', 'Бира', 150, 4, 0)])

  it('splits units into free, solo, shared, and others', () => {
    const view = buildClaimGroupSeatView({
      group: beer,
      assignments: [
        { itemId: 'beer', unitIndex: 0, participantId: 'a' },
        { itemId: 'beer', unitIndex: 1, participantId: 'a' },
        { itemId: 'beer', unitIndex: 1, participantId: 'b' },
        { itemId: 'beer', unitIndex: 2, participantId: 'c' },
      ],
      seatId: 'a',
      participants,
    })

    expect(view.totalUnits).toBe(4)
    expect(view.freeUnits).toEqual([{ itemId: 'beer', unitIndex: 3 }])
    expect(view.mySoloUnits).toEqual([{ itemId: 'beer', unitIndex: 0 }])
    expect(view.mySharedUnits).toEqual([
      {
        unit: { itemId: 'beer', unitIndex: 1 },
        coMemberIds: ['b'],
        myShareCents: 75,
      },
    ])
    expect(view.othersUnits).toEqual([
      { unit: { itemId: 'beer', unitIndex: 2 }, memberIds: ['c'] },
    ])
    expect(view.myUnitCount).toBe(2)
    expect(view.claimedUnitCount).toBe(3)
    expect(view.myShareCents).toBe(225)
  })

  it('summarizes other claimants in seat order', () => {
    const view = buildClaimGroupSeatView({
      group: beer,
      assignments: [
        { itemId: 'beer', unitIndex: 0, participantId: 'c' },
        { itemId: 'beer', unitIndex: 1, participantId: 'b' },
        { itemId: 'beer', unitIndex: 2, participantId: 'c' },
      ],
      seatId: 'a',
      participants,
    })
    expect(view.otherClaimantCounts).toEqual([
      { participantId: 'b', units: 1 },
      { participantId: 'c', units: 2 },
    ])
  })

  it('lists joinable member sets from units held by others', () => {
    const view = buildClaimGroupSeatView({
      group: beer,
      assignments: [
        { itemId: 'beer', unitIndex: 0, participantId: 'b' },
        { itemId: 'beer', unitIndex: 1, participantId: 'c' },
        { itemId: 'beer', unitIndex: 1, participantId: 'b' },
        { itemId: 'beer', unitIndex: 2, participantId: 'b' },
      ],
      seatId: 'a',
      participants,
    })
    expect(view.joinOptions).toEqual([
      {
        memberIds: ['b'],
        units: [
          { itemId: 'beer', unitIndex: 0 },
          { itemId: 'beer', unitIndex: 2 },
        ],
        joinedShareCents: 75,
      },
      {
        memberIds: ['b', 'c'],
        units: [{ itemId: 'beer', unitIndex: 1 }],
        joinedShareCents: 50,
      },
    ])
  })

  it('reports an empty view when nothing is assigned', () => {
    const view = buildClaimGroupSeatView({
      group: beer,
      assignments: [],
      seatId: 'a',
      participants,
    })
    expect(view.freeUnits).toHaveLength(4)
    expect(view.myUnitCount).toBe(0)
    expect(view.claimedUnitCount).toBe(0)
    expect(view.myShareCents).toBe(0)
  })
})

describe('claim preview matches final totals', () => {
  it('uses the same per-unit split as calculateParticipantBreakdown', () => {
    const seats = [
      { id: 'id_bbb', sortOrder: 0 },
      { id: 'id_aaa', sortOrder: 1 },
    ]
    const assignments = [
      { itemId: 'i1', participantId: 'id_aaa', unitIndex: 0 },
      { itemId: 'i1', participantId: 'id_bbb', unitIndex: 0 },
    ]
    const [salad] = groupClaimItems([item('i1', 'Salad', 1001, 1, 0)])

    for (const seatId of ['id_bbb', 'id_aaa']) {
      const view = buildClaimGroupSeatView({
        group: salad,
        assignments,
        seatId,
        participants: seats,
      })
      const breakdown = calculateParticipantBreakdown(
        {
          participants: seats,
          items: [
            { id: 'i1', name: 'Salad', unitPriceCents: 1001, quantity: 1 },
          ],
          assignments,
          tipCents: 0,
        },
        seatId,
      )
      expect(view.myShareCents).toBe(breakdown.lines[0]?.amountCents)
    }
  })
})
