import { describe, expect, it } from 'vitest'
import { getBillStepCompletion } from './bill-step-completion'

const p1 = { id: 'p1', sortOrder: 0 }
const i1 = { id: 'i1', unitPriceCents: 1000, quantity: 1 }
const a1 = { itemId: 'i1', participantId: 'p1' }

describe('getBillStepCompletion', () => {
  it('marks step 1 done only when restaurant name is non-empty after trim', () => {
    expect(
      getBillStepCompletion({
        restaurantName: '   ',
        participants: [],
        items: [],
        assignments: [],
      })[1],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: '  Механа  ',
        participants: [],
        items: [],
        assignments: [],
      })[1],
    ).toBe(true)
  })

  it('marks step 2 done when there is at least one participant', () => {
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [],
        items: [],
        assignments: [],
      })[2],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [],
        assignments: [],
      })[2],
    ).toBe(true)
  })

  it('marks step 3 done when every item has an assignment and there is ≥1 item', () => {
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [],
        assignments: [],
      })[3],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [i1],
        assignments: [],
      })[3],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [i1],
        assignments: [a1],
      })[3],
    ).toBe(true)
  })

  it('marks step 3 done for zero-price items when assigned', () => {
    const free = { id: 'i2', unitPriceCents: 0, quantity: 1 }
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [free],
        assignments: [{ itemId: 'i2', participantId: 'p1' }],
      })[3],
    ).toBe(true)
  })

  it('does not require restaurant for step 3 done', () => {
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [],
        items: [i1],
        assignments: [a1],
      })[3],
    ).toBe(true)
  })

  it('marks step 4 done only when finalize validation passes', () => {
    // step 3 done but missing restaurant → step 4 incomplete
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [i1],
        assignments: [a1],
      })[4],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: 'Механа',
        participants: [p1],
        items: [i1],
        assignments: [a1],
      })[4],
    ).toBe(true)
  })
})
