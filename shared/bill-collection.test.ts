import { describe, expect, it } from 'vitest'
import {
  aggregateDebtors,
  buildBillCollectionFields,
  countPaidGuests,
  deriveBillNextAction,
  describeMissingForBill,
  normalizeDebtorKey,
  toGuestBalance,
} from './bill-collection'
import type { BillCollectionInput, GuestBalance } from './bill-collection'

const host = { id: 'host', name: 'Домакин', sortOrder: 0 }
const ivan = { id: 'ivan', name: 'Иван', sortOrder: 1 }
const maria = { id: 'maria', name: 'Мария', sortOrder: 2 }

/** One 30.00 item, one Unit each for host, Иван, Мария. */
function preparedBill(
  overrides: Partial<BillCollectionInput> = {},
): BillCollectionInput {
  return {
    restaurantName: 'Механа',
    participants: [host, ivan, maria],
    items: [{ id: 'i1', unitPriceCents: 1000, quantity: 3 }],
    assignments: [
      { itemId: 'i1', participantId: 'host', unitIndex: 0 },
      { itemId: 'i1', participantId: 'ivan', unitIndex: 1 },
      { itemId: 'i1', participantId: 'maria', unitIndex: 2 },
    ],
    payments: [],
    hostParticipantId: 'host',
    ...overrides,
  }
}

function balance(
  participantId: string,
  name: string,
  outstandingCents: number,
): GuestBalance {
  return {
    participantId,
    name,
    owedCents: outstandingCents,
    paidCents: 0,
    outstandingCents,
  }
}

describe('buildBillCollectionFields', () => {
  it('excludes the Host seat from guest balances and outstanding', () => {
    const fields = buildBillCollectionFields(preparedBill())

    expect(fields.guestBalances.map((b) => b.participantId)).toEqual([
      'ivan',
      'maria',
    ])
    expect(fields.outstandingCents).toBe(2000)
    expect(fields.collectedCents).toBe(0)
    expect(fields.guestCount).toBe(2)
    expect(fields.paidGuestCount).toBe(0)
  })

  it('sorts guest balances by sortOrder and carries names', () => {
    const fields = buildBillCollectionFields(
      preparedBill({ participants: [maria, host, ivan] }),
    )

    expect(fields.guestBalances).toEqual([
      {
        participantId: 'ivan',
        name: 'Иван',
        owedCents: 1000,
        paidCents: 0,
        outstandingCents: 1000,
      },
      {
        participantId: 'maria',
        name: 'Мария',
        owedCents: 1000,
        paidCents: 0,
        outstandingCents: 1000,
      },
    ])
  })

  it('tracks partial payments as collected and still outstanding', () => {
    const fields = buildBillCollectionFields(
      preparedBill({
        payments: [{ participantId: 'ivan', amountCents: 400 }],
      }),
    )

    expect(fields.guestBalances[0]).toMatchObject({
      paidCents: 400,
      outstandingCents: 600,
    })
    expect(fields.outstandingCents).toBe(1600)
    expect(fields.collectedCents).toBe(400)
    expect(fields.paidGuestCount).toBe(0)
  })

  it('caps overpayment: no negative outstanding, collected capped at Share', () => {
    const fields = buildBillCollectionFields(
      preparedBill({
        payments: [
          { participantId: 'ivan', amountCents: 1500 },
          { participantId: 'maria', amountCents: 1000 },
        ],
      }),
    )

    expect(fields.guestBalances[0]).toMatchObject({
      owedCents: 1000,
      paidCents: 1500,
      outstandingCents: 0,
    })
    expect(fields.outstandingCents).toBe(0)
    expect(fields.collectedCents).toBe(2000)
    expect(fields.paidGuestCount).toBe(2)
  })

  it('does not count a guest with no Share as paid', () => {
    const fields = buildBillCollectionFields(
      preparedBill({
        participants: [
          host,
          ivan,
          maria,
          { id: 'zero', name: 'Петър', sortOrder: 3 },
        ],
        payments: [{ participantId: 'ivan', amountCents: 1000 }],
      }),
    )

    expect(fields.guestCount).toBe(3)
    expect(fields.paidGuestCount).toBe(1)
  })

  it('spreads tip into guest Shares', () => {
    const fields = buildBillCollectionFields(preparedBill({ tipCents: 300 }))

    expect(fields.guestBalances.map((b) => b.owedCents)).toEqual([1100, 1100])
    expect(fields.outstandingCents).toBe(2200)
  })

  it('marks a fully assigned bill as prepared with step 4 next', () => {
    const fields = buildBillCollectionFields(preparedBill())

    expect(fields.prepared).toBe(true)
    expect(fields.firstIncompleteStep).toBe(4)
    expect(fields.unassignedItemCount).toBe(0)
    expect(fields.hasPricedItems).toBe(true)
  })

  it('reports a not-prepared bill with unassigned items', () => {
    const fields = buildBillCollectionFields(
      preparedBill({
        items: [
          { id: 'i1', unitPriceCents: 1000, quantity: 3 },
          { id: 'i2', unitPriceCents: 500, quantity: 1 },
        ],
      }),
    )

    expect(fields.prepared).toBe(false)
    expect(fields.unassignedItemCount).toBe(1)
    expect(fields.firstIncompleteStep).toBe(3)
  })

  it('points to step 1 when the restaurant name is missing', () => {
    const fields = buildBillCollectionFields(
      preparedBill({ restaurantName: '  ' }),
    )

    expect(fields.prepared).toBe(false)
    expect(fields.firstIncompleteStep).toBe(1)
  })

  it('points to step 2 when only the Host seat exists', () => {
    const fields = buildBillCollectionFields(
      preparedBill({
        participants: [host],
        assignments: [
          { itemId: 'i1', participantId: 'host', unitIndex: 0 },
          { itemId: 'i1', participantId: 'host', unitIndex: 1 },
          { itemId: 'i1', participantId: 'host', unitIndex: 2 },
        ],
      }),
    )

    expect(fields.prepared).toBe(false)
    expect(fields.guestCount).toBe(0)
    expect(fields.guestBalances).toEqual([])
    expect(fields.outstandingCents).toBe(0)
    expect(fields.firstIncompleteStep).toBe(2)
  })

  it('handles an empty new bill', () => {
    const fields = buildBillCollectionFields({
      restaurantName: '',
      participants: [host],
      items: [],
      assignments: [],
      payments: [],
      hostParticipantId: 'host',
    })

    expect(fields).toEqual({
      outstandingCents: 0,
      collectedCents: 0,
      guestBalances: [],
      prepared: false,
      firstIncompleteStep: 1,
      unassignedItemCount: 0,
      hasPricedItems: false,
      guestCount: 0,
      paidGuestCount: 0,
    })
  })

  it('treats every seat as a Guest when the Host seat is unknown', () => {
    const fields = buildBillCollectionFields(
      preparedBill({ hostParticipantId: undefined }),
    )

    expect(fields.guestCount).toBe(3)
    expect(fields.outstandingCents).toBe(3000)
  })
})

describe('deriveBillNextAction', () => {
  it('returns done for final bills', () => {
    expect(
      deriveBillNextAction({
        status: 'final',
        prepared: true,
        outstandingCents: 0,
      }),
    ).toBe('done')
  })

  it('returns finish for drafts that are not prepared', () => {
    expect(
      deriveBillNextAction({
        status: 'draft',
        prepared: false,
        outstandingCents: 500,
      }),
    ).toBe('finish')
  })

  it('returns collect for prepared drafts with outstanding', () => {
    expect(
      deriveBillNextAction({
        status: 'draft',
        prepared: true,
        outstandingCents: 1,
      }),
    ).toBe('collect')
  })

  it('returns close for prepared drafts with nothing outstanding', () => {
    expect(
      deriveBillNextAction({
        status: 'draft',
        prepared: true,
        outstandingCents: 0,
      }),
    ).toBe('close')
  })
})

describe('describeMissingForBill', () => {
  const ready = {
    restaurantName: 'Механа',
    guestCount: 1,
    hasPricedItems: true,
    unassignedItemCount: 0,
  }

  it('returns null when nothing is missing', () => {
    expect(describeMissingForBill(ready)).toBeNull()
  })

  it('reports the restaurant first', () => {
    expect(
      describeMissingForBill({
        restaurantName: ' ',
        guestCount: 0,
        hasPricedItems: false,
        unassignedItemCount: 2,
      }),
    ).toBe('Липсва ресторант')
  })

  it('reports missing guests before items', () => {
    expect(
      describeMissingForBill({
        ...ready,
        guestCount: 0,
        hasPricedItems: false,
        unassignedItemCount: 2,
      }),
    ).toBe('Няма гости')
  })

  it('reports missing priced items before unassigned', () => {
    expect(
      describeMissingForBill({
        ...ready,
        hasPricedItems: false,
        unassignedItemCount: 2,
      }),
    ).toBe('Няма артикули с цена')
  })

  it('reports unassigned item count with Bulgarian agreement', () => {
    expect(describeMissingForBill({ ...ready, unassignedItemCount: 3 })).toBe(
      '3 неразпределени',
    )
    expect(describeMissingForBill({ ...ready, unassignedItemCount: 1 })).toBe(
      '1 неразпределен',
    )
  })
})

describe('normalizeDebtorKey', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeDebtorKey('  Иван   Петров ')).toBe('иван петров')
  })

  it('normalizes to NFC', () => {
    const decomposed = 'Йоана'.normalize('NFD')
    expect(decomposed).not.toBe('Йоана')
    expect(normalizeDebtorKey(decomposed)).toBe(normalizeDebtorKey('йоана'))
  })
})

describe('toGuestBalance and countPaidGuests', () => {
  it('derives outstanding from stored owed and paid', () => {
    expect(
      toGuestBalance({
        participantId: 'p',
        name: 'Иван',
        owedCents: 1000,
        paidCents: 1200,
      }),
    ).toEqual({
      participantId: 'p',
      name: 'Иван',
      owedCents: 1000,
      paidCents: 1200,
      outstandingCents: 0,
    })
  })

  it('counts guests who paid a positive Share in full', () => {
    expect(
      countPaidGuests([
        toGuestBalance({
          participantId: 'a',
          name: 'A',
          owedCents: 500,
          paidCents: 500,
        }),
        toGuestBalance({
          participantId: 'b',
          name: 'B',
          owedCents: 500,
          paidCents: 100,
        }),
        toGuestBalance({
          participantId: 'c',
          name: 'C',
          owedCents: 0,
          paidCents: 0,
        }),
      ]),
    ).toBe(1)
  })
})

describe('aggregateDebtors', () => {
  it('returns nothing for empty input', () => {
    expect(aggregateDebtors([])).toEqual([])
  })

  it('skips balances with nothing outstanding', () => {
    expect(
      aggregateDebtors([
        {
          billId: 'b1',
          restaurantName: 'Механа',
          date: 1,
          guestBalances: [
            {
              participantId: 'p1',
              name: 'Иван',
              owedCents: 1000,
              paidCents: 1000,
              outstandingCents: 0,
            },
          ],
        },
      ]),
    ).toEqual([])
  })

  it('merges the same person across bills ignoring case and whitespace', () => {
    const debtors = aggregateDebtors([
      {
        billId: 'b1',
        restaurantName: 'Механа',
        date: 10,
        shareToken: 't1',
        guestBalances: [balance('p1', 'Иван', 500)],
      },
      {
        billId: 'b2',
        restaurantName: 'Пицария',
        date: 20,
        guestBalances: [balance('p2', '  иван ', 1500)],
      },
    ])

    expect(debtors).toEqual([
      {
        key: 'иван',
        name: 'Иван',
        outstandingCents: 2000,
        bills: [
          {
            billId: 'b2',
            restaurantName: 'Пицария',
            date: 20,
            outstandingCents: 1500,
          },
          {
            billId: 'b1',
            restaurantName: 'Механа',
            date: 10,
            outstandingCents: 500,
            shareToken: 't1',
          },
        ],
      },
    ])
  })

  it('combines two seats with the same name on one bill', () => {
    const debtors = aggregateDebtors([
      {
        billId: 'b1',
        restaurantName: 'Механа',
        date: 10,
        guestBalances: [balance('p1', 'Иван', 500), balance('p2', 'ИВАН', 300)],
      },
    ])

    expect(debtors).toHaveLength(1)
    expect(debtors[0].outstandingCents).toBe(800)
    expect(debtors[0].bills).toEqual([
      {
        billId: 'b1',
        restaurantName: 'Механа',
        date: 10,
        outstandingCents: 800,
      },
    ])
  })

  it('sorts by outstanding desc, then by name', () => {
    const debtors = aggregateDebtors([
      {
        billId: 'b1',
        restaurantName: 'Механа',
        date: 10,
        guestBalances: [
          balance('p1', 'Мария', 500),
          balance('p2', 'Борис', 900),
          balance('p3', 'Ангел', 500),
        ],
      },
    ])

    expect(debtors.map((d) => d.name)).toEqual(['Борис', 'Ангел', 'Мария'])
  })
})
