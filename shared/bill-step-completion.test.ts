import { describe, expect, it } from 'vitest'
import { getBillStepCompletion } from './bill-step-completion'

const p1 = { id: 'p1', sortOrder: 1 }
const i1 = { id: 'i1', unitPriceCents: 1000, quantity: 1 }
const a1 = { itemId: 'i1', participantId: 'p1', unitIndex: 0 }

describe('getBillStepCompletion', () => {
  // Steps 1–3 are views over `bill-readiness`; its tests cover each predicate.
  it('maps steps 1–3 to the bill readiness views', () => {
    const host = { id: 'host', sortOrder: 0 }
    expect(
      getBillStepCompletion({
        restaurantName: 'Механа',
        participants: [host],
        items: [i1],
        assignments: [],
        hostParticipantId: 'host',
      }),
    ).toMatchObject({ 1: true, 2: false, 3: false })
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [host, p1],
        items: [i1],
        assignments: [a1],
        hostParticipantId: 'host',
      }),
    ).toMatchObject({ 1: false, 2: true, 3: true })
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
