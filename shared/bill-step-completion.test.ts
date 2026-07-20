import { describe, expect, it } from 'vitest'
import { getBillStepCompletion } from './bill-step-completion'

const p1 = { id: 'p1', sortOrder: 0 }
const i1 = { id: 'i1', unitPriceCents: 1000, quantity: 1 }
const a1 = { itemId: 'i1', participantId: 'p1', unitIndex: 0 }

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

  it('does not mark step 2 done when only the host participant exists', () => {
    const host = { id: 'host', sortOrder: 0 }
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [host],
        items: [],
        assignments: [],
        hostParticipantId: 'host',
      })[2],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [host, p1],
        items: [],
        assignments: [],
        hostParticipantId: 'host',
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
        assignments: [{ itemId: 'i2', participantId: 'p1', unitIndex: 0 }],
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

  it('does not mark step 3 done when a multi-qty item has an empty unit', () => {
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [{ id: 'i2', unitPriceCents: 100, quantity: 2 }],
        assignments: [{ itemId: 'i2', participantId: 'p1', unitIndex: 0 }],
      })[3],
    ).toBe(false)
  })

  it('marks step 4 incomplete when finalize validation fails', () => {
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [i1],
        assignments: [a1],
        payments: [{ participantId: 'p1', amountCents: 1000 }],
      })[4],
    ).toBe(false)
  })

  it('marks step 4 incomplete when finalize-ready but someone is unpaid', () => {
    expect(
      getBillStepCompletion({
        restaurantName: 'Механа',
        participants: [p1],
        items: [i1],
        assignments: [a1],
        payments: [],
      })[4],
    ).toBe(false)
  })

  it('marks step 4 done when finalize-ready and everyone is paid', () => {
    expect(
      getBillStepCompletion({
        restaurantName: 'Механа',
        participants: [p1],
        items: [i1],
        assignments: [a1],
        payments: [{ participantId: 'p1', amountCents: 1000 }],
      })[4],
    ).toBe(true)
  })

  it('treats host as paid for step 4 when hostParticipantId is set', () => {
    const host = { id: 'host', sortOrder: 0 }
    const guest = { id: 'guest', sortOrder: 1 }
    const item = { id: 'i1', unitPriceCents: 1000, quantity: 1 }
    expect(
      getBillStepCompletion({
        restaurantName: 'Механа',
        participants: [host, guest],
        items: [item],
        assignments: [
          { itemId: 'i1', participantId: 'host', unitIndex: 0 },
          { itemId: 'i1', participantId: 'guest', unitIndex: 0 },
        ],
        payments: [{ participantId: 'guest', amountCents: 500 }],
        hostParticipantId: 'host',
      })[4],
    ).toBe(true)
  })
})
