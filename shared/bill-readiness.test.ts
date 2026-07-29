import { describe, expect, it } from 'vitest'
import {
  hasPricedItems,
  isAllocationReady,
  isBillDetailsStepReady,
  isParticipantsStepReady,
  isPreparedBill,
  isPreparedBillFromParticipants,
  isRestaurantReady,
} from './bill-readiness'

const i1 = { id: 'i1', unitPriceCents: 500, quantity: 1 }
const a1 = { itemId: 'i1', participantId: 'g1', unitIndex: 0 }
const host = { id: 'host', sortOrder: 0 }
const guest = { id: 'g1', sortOrder: 1 }

describe('bill readiness predicates', () => {
  it('detects restaurant readiness', () => {
    expect(isRestaurantReady('')).toBe(false)
    expect(isRestaurantReady('  Механа  ')).toBe(true)
  })

  it('requires priced items for allocation and prepared bill', () => {
    const free = { id: 'i2', unitPriceCents: 0, quantity: 1 }
    expect(hasPricedItems([free])).toBe(false)
    expect(
      isAllocationReady({
        items: [free],
        assignments: [{ itemId: 'i2', participantId: 'g1', unitIndex: 0 }],
      }),
    ).toBe(false)
  })

  it('marks prepared bill when all conjuncts hold', () => {
    expect(
      isPreparedBill({
        restaurantName: 'Механа',
        guestCount: 1,
        items: [i1],
        assignments: [a1],
      }),
    ).toBe(true)
  })

  it('derives prepared bill from participants excluding host seat', () => {
    expect(
      isPreparedBillFromParticipants({
        restaurantName: 'Механа',
        participants: [host, guest],
        items: [i1],
        assignments: [a1],
        hostParticipantId: 'host',
      }),
    ).toBe(true)
    expect(
      isPreparedBillFromParticipants({
        restaurantName: 'Механа',
        participants: [host],
        items: [i1],
        assignments: [a1],
        hostParticipantId: 'host',
      }),
    ).toBe(false)
  })
})

describe('bill readiness step views', () => {
  it('aligns step 1 with restaurant predicate', () => {
    expect(isBillDetailsStepReady('Механа')).toBe(true)
  })

  it('aligns step 2 with guest count', () => {
    expect(
      isParticipantsStepReady({
        participants: [host],
        hostParticipantId: 'host',
      }),
    ).toBe(false)
    expect(
      isParticipantsStepReady({
        participants: [host, guest],
        hostParticipantId: 'host',
      }),
    ).toBe(true)
  })

  it('aligns allocation step with priced items and unit coverage', () => {
    expect(
      isAllocationReady({
        items: [i1],
        assignments: [a1],
      }),
    ).toBe(true)
    expect(
      isAllocationReady({
        items: [i1],
        assignments: [],
      }),
    ).toBe(false)
  })

  it('does not mark allocation ready when step 3 would disagree with prepared bill', () => {
    const free = { id: 'i2', unitPriceCents: 0, quantity: 1 }
    const assigned = [{ itemId: 'i2', participantId: 'g1', unitIndex: 0 }]
    expect(isAllocationReady({ items: [free], assignments: assigned })).toBe(
      false,
    )
    expect(
      isPreparedBill({
        restaurantName: 'Механа',
        guestCount: 1,
        items: [free],
        assignments: assigned,
      }),
    ).toBe(false)
  })
})
