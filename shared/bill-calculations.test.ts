import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  calculateBillTotals,
  calculateParticipantBreakdown,
  validateBillForFinalize,
} from './bill-calculations'
import type {
  BillBreakdownInput,
  BillCalculationInput,
} from './bill-calculations'

describe('payment status for a zero Share', () => {
  it('counts a Participant who owes nothing as paid', () => {
    const totals = calculateBillTotals({
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [{ itemId: 'i1', participantId: 'p1', unitIndex: 0 }],
      payments: [],
    })
    expect(totals.byParticipant.p2).toMatchObject({
      owedCents: 0,
      balanceCents: 0,
      status: 'paid',
    })
    expect(totals.byParticipant.p1.status).toBe('unpaid')
  })
})

describe('calculateBillTotals', () => {
  it('uses per-unit membership rows for share totals', () => {
    const input: BillCalculationInput = {
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
        { id: 'p3', sortOrder: 2 },
      ],
      items: [{ id: 'i1', unitPriceCents: 229, quantity: 4 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p1', unitIndex: 1 },
        { itemId: 'i1', participantId: 'p2', unitIndex: 2 },
        { itemId: 'i1', participantId: 'p3', unitIndex: 3 },
      ],
      payments: [],
    }
    const totals = calculateBillTotals(input)
    expect(totals.byParticipant.p1.owedCents).toBe(458)
    expect(totals.byParticipant.p2.owedCents).toBe(229)
    expect(totals.byParticipant.p3.owedCents).toBe(229)
  })

  it('computes owed, paid, and balance per participant', () => {
    const input: BillCalculationInput = {
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
      ],
      items: [
        { id: 'i1', unitPriceCents: 1000, quantity: 1 },
        { id: 'i2', unitPriceCents: 2000, quantity: 1 },
      ],
      assignments: [
        { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
        { itemId: 'i2', participantId: 'p2', unitIndex: 0 },
      ],
      payments: [{ participantId: 'p1', amountCents: 1000 }],
    }
    const totals = calculateBillTotals(input)
    expect(totals.billTotalCents).toBe(3000)
    expect(totals.byParticipant.p1).toMatchObject({
      owedCents: 1000,
      paidCents: 1000,
      balanceCents: 0,
      status: 'paid',
    })
    expect(totals.byParticipant.p2).toMatchObject({
      owedCents: 2000,
      paidCents: 0,
      balanceCents: 2000,
      status: 'unpaid',
    })
  })

  it('splits tip equally among all participants', () => {
    const input: BillCalculationInput = {
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
        { id: 'p3', sortOrder: 2 },
      ],
      items: [{ id: 'i1', unitPriceCents: 900, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p2', unitIndex: 0 },
      ],
      payments: [],
      tipCents: 300,
    }
    const totals = calculateBillTotals(input)
    expect(totals.billTotalCents).toBe(1200)
    expect(totals.byParticipant.p1.owedCents).toBe(550)
    expect(totals.byParticipant.p2.owedCents).toBe(550)
    expect(totals.byParticipant.p3.owedCents).toBe(100)
  })
})

describe('validateBillForFinalize', () => {
  it('returns missing_restaurant when restaurant name is empty', () => {
    const errors = validateBillForFinalize({
      restaurantName: '   ',
      participants: [{ id: 'p1', sortOrder: 0 }],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [{ itemId: 'i1', participantId: 'p1', unitIndex: 0 }],
    })
    expect(errors).toContainEqual({
      code: 'missing_restaurant',
      message: 'Въведете име на ресторант.',
    })
  })

  it('blocks finalize when any item is unassigned, including zero-price items', () => {
    const errors = validateBillForFinalize({
      restaurantName: 'Механа',
      participants: [{ id: 'p1', sortOrder: 0 }],
      items: [
        { id: 'i1', unitPriceCents: 1000, quantity: 1 },
        { id: 'i2', unitPriceCents: 0, quantity: 1 },
      ],
      assignments: [{ itemId: 'i1', participantId: 'p1', unitIndex: 0 }],
    })
    expect(errors).toContainEqual({
      code: 'empty_units',
      message: 'Има 1 неразпределен артикул.',
    })
  })

  it('reports plural unassigned item count', () => {
    const errors = validateBillForFinalize({
      restaurantName: 'Механа',
      participants: [{ id: 'p1', sortOrder: 0 }],
      items: [
        { id: 'i1', unitPriceCents: 1000, quantity: 1 },
        { id: 'i2', unitPriceCents: 500, quantity: 1 },
      ],
      assignments: [],
    })
    expect(errors).toContainEqual({
      code: 'empty_units',
      message: 'Има 2 неразпределени артикула.',
    })
  })

  it('blocks finalize when a participant is not marked paid', () => {
    const errors = validateBillForFinalize({
      restaurantName: 'Механа',
      participants: [{ id: 'p1', sortOrder: 0 }],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [{ itemId: 'i1', participantId: 'p1', unitIndex: 0 }],
      payments: [],
    })
    expect(errors).toContainEqual({
      code: 'unpaid_participants',
      message:
        'Маркирайте всички участници като платили, преди да завършите сметката.',
    })
  })

  it('allows finalize when every participant is paid', () => {
    const errors = validateBillForFinalize({
      restaurantName: 'Механа',
      participants: [{ id: 'p1', sortOrder: 0 }],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [{ itemId: 'i1', participantId: 'p1', unitIndex: 0 }],
      payments: [{ participantId: 'p1', amountCents: 1000 }],
    })
    expect(errors.some((e) => e.code === 'unpaid_participants')).toBe(false)
  })

  it('does not wait on a Guest with no Share (nothing to collect)', () => {
    const errors = validateBillForFinalize({
      restaurantName: 'Механа',
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [{ itemId: 'i1', participantId: 'p1', unitIndex: 0 }],
      payments: [{ participantId: 'p1', amountCents: 1000 }],
    })
    expect(errors.some((e) => e.code === 'unpaid_participants')).toBe(false)
  })
})

describe('cent remainders', () => {
  it('splits €10.00 evenly among 3 participants (remainder cents)', () => {
    const totals = calculateBillTotals({
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
        { id: 'p3', sortOrder: 2 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p2', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p3', unitIndex: 0 },
      ],
      payments: [],
    })
    expect(totals.byParticipant.p1.owedCents).toBe(334)
    expect(totals.byParticipant.p2.owedCents).toBe(333)
    expect(totals.byParticipant.p3.owedCents).toBe(333)
  })

  it('splits €10.01 evenly among 3 participants', () => {
    const totals = calculateBillTotals({
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
        { id: 'p3', sortOrder: 2 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1001, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p2', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p3', unitIndex: 0 },
      ],
      payments: [],
    })
    expect(totals.byParticipant.p1.owedCents).toBe(334)
    expect(totals.byParticipant.p2.owedCents).toBe(334)
    expect(totals.byParticipant.p3.owedCents).toBe(333)
  })
})

describe('always-paid Host collection rule', () => {
  it('treats Host with Share > 0 and no payment rows as paid with zero outstanding', () => {
    const totals = calculateBillTotals({
      hostParticipantId: 'host',
      participants: [
        { id: 'host', sortOrder: 0 },
        { id: 'guest', sortOrder: 1 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'host', unitIndex: 0 },
        { itemId: 'i1', participantId: 'guest', unitIndex: 0 },
      ],
      payments: [],
    })

    expect(totals.byParticipant.host).toMatchObject({
      owedCents: 500,
      paidCents: 500,
      balanceCents: 0,
      status: 'paid',
    })
    expect(totals.byParticipant.guest).toMatchObject({
      owedCents: 500,
      paidCents: 0,
      balanceCents: 500,
      status: 'unpaid',
    })
  })

  it('still splits tip across all Participants including Host with no claimed items', () => {
    const totals = calculateBillTotals({
      hostParticipantId: 'host',
      participants: [
        { id: 'host', sortOrder: 0 },
        { id: 'guest1', sortOrder: 1 },
        { id: 'guest2', sortOrder: 2 },
      ],
      items: [{ id: 'i1', unitPriceCents: 900, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'guest1', unitIndex: 0 },
        { itemId: 'i1', participantId: 'guest2', unitIndex: 0 },
      ],
      payments: [],
      tipCents: 300,
    })

    expect(totals.billTotalCents).toBe(1200)
    expect(totals.byParticipant.host.owedCents).toBe(100)
    expect(totals.byParticipant.host.status).toBe('paid')
    expect(totals.byParticipant.guest1.owedCents).toBe(550)
    expect(totals.byParticipant.guest2.owedCents).toBe(550)
  })

  it('keeps Host non-outstanding when Share grows without payment rows', () => {
    const before = calculateBillTotals({
      hostParticipantId: 'host',
      participants: [
        { id: 'host', sortOrder: 0 },
        { id: 'guest', sortOrder: 1 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [{ itemId: 'i1', participantId: 'guest', unitIndex: 0 }],
      payments: [],
      tipCents: 0,
    })
    expect(before.byParticipant.host.owedCents).toBe(0)
    expect(before.byParticipant.host.status).toBe('paid')

    const after = calculateBillTotals({
      hostParticipantId: 'host',
      participants: [
        { id: 'host', sortOrder: 0 },
        { id: 'guest', sortOrder: 1 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'host', unitIndex: 0 },
        { itemId: 'i1', participantId: 'guest', unitIndex: 0 },
      ],
      payments: [],
      tipCents: 0,
    })
    expect(after.byParticipant.host.owedCents).toBe(500)
    expect(after.byParticipant.host).toMatchObject({
      paidCents: 500,
      balanceCents: 0,
      status: 'paid',
    })
    expect(after.byParticipant.guest.balanceCents).toBe(500)
  })

  it('splits a single unit evenly among multiple participants on that unit', () => {
    const totals = calculateBillTotals({
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
      ],
      items: [{ id: 'i1', unitPriceCents: 101, quantity: 2 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p2', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p2', unitIndex: 1 },
      ],
      payments: [],
    })

    expect(totals.byParticipant.p1.owedCents).toBe(51)
    expect(totals.byParticipant.p2.owedCents).toBe(151)
  })
})

describe('calculateParticipantBreakdown', () => {
  const baseInput: BillBreakdownInput = {
    participants: [
      { id: 'p1', sortOrder: 0 },
      { id: 'p2', sortOrder: 1 },
      { id: 'p3', sortOrder: 2 },
    ],
    items: [
      { id: 'i1', name: 'Пица', unitPriceCents: 1200, quantity: 1 },
      { id: 'i2', name: 'Кола', unitPriceCents: 229, quantity: 4 },
    ],
    assignments: [
      { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
      { itemId: 'i1', participantId: 'p2', unitIndex: 0 },
      { itemId: 'i2', participantId: 'p1', unitIndex: 0 },
      { itemId: 'i2', participantId: 'p1', unitIndex: 1 },
      { itemId: 'i2', participantId: 'p2', unitIndex: 2 },
      { itemId: 'i2', participantId: 'p3', unitIndex: 3 },
    ],
    tipCents: 300,
  }

  it('returns item lines with correct amounts for unit and equal splits', () => {
    const p1 = calculateParticipantBreakdown(baseInput, 'p1')
    expect(p1.itemsSubtotalCents).toBe(1058)
    expect(p1.tipCents).toBe(100)
    expect(p1.owedCents).toBe(1158)
    expect(p1.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'item',
          label: 'Пица',
          amountCents: 600,
          sharedWithCount: 1,
          sharedWithParticipantIds: ['p2'],
        }),
        expect.objectContaining({
          kind: 'item',
          label: 'Кола',
          amountCents: 458,
          units: 2,
          totalUnits: 4,
        }),
        expect.objectContaining({ kind: 'tip', amountCents: 100 }),
      ]),
    )
  })

  it('includes shared-with metadata on multi-qty items when a unit is co-claimed', () => {
    const input: BillBreakdownInput = {
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
      ],
      items: [{ id: 'i1', name: 'Бира', unitPriceCents: 400, quantity: 3 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p1', unitIndex: 1 },
        { itemId: 'i1', participantId: 'p1', unitIndex: 2 },
        { itemId: 'i1', participantId: 'p2', unitIndex: 2 },
      ],
    }

    const p1 = calculateParticipantBreakdown(input, 'p1')
    expect(p1.lines).toEqual([
      expect.objectContaining({
        kind: 'item',
        label: 'Бира',
        amountCents: 1000,
        units: 3,
        totalUnits: 3,
        sharedWithCount: 1,
        sharedWithParticipantIds: ['p2'],
      }),
    ])
  })
})

/** Any bill: seats, lines, Unit memberships (empty Units allowed), tip, payments, maybe a Host. */
const arbitraryBill: fc.Arbitrary<BillCalculationInput> = fc
  .record({
    seatCount: fc.integer({ min: 1, max: 6 }),
    items: fc.array(
      fc.record({
        unitPriceCents: fc.integer({ min: 0, max: 20_000 }),
        quantity: fc.integer({ min: 1, max: 5 }),
      }),
      { maxLength: 6 },
    ),
  })
  .chain(({ seatCount, items }) => {
    const seatIds = Array.from({ length: seatCount }, (_, index) => `p${index}`)
    const unitCount = items.reduce((sum, item) => sum + item.quantity, 0)
    return fc
      .record({
        sortOrders: fc.shuffledSubarray(
          seatIds.map((_, index) => index),
          { minLength: seatCount, maxLength: seatCount },
        ),
        unitMembers: fc.array(fc.subarray(seatIds), {
          minLength: unitCount,
          maxLength: unitCount,
        }),
        tipCents: fc.integer({ min: 0, max: 5_000 }),
        payments: fc.array(
          fc.record({
            participantId: fc.constantFrom(...seatIds),
            amountCents: fc.integer({ min: 1, max: 30_000 }),
          }),
          { maxLength: 4 },
        ),
        hostParticipantId: fc.option(fc.constantFrom(...seatIds), {
          nil: undefined,
        }),
      })
      .map(({ sortOrders, unitMembers, ...rest }) => {
        const units = items.flatMap((item, itemIndex) =>
          Array.from({ length: item.quantity }, (_, unitIndex) => ({
            itemId: `i${itemIndex}`,
            unitIndex,
          })),
        )
        return {
          ...rest,
          participants: seatIds.map((id, index) => ({
            id,
            sortOrder: sortOrders[index],
          })),
          items: items.map((item, index) => ({ id: `i${index}`, ...item })),
          assignments: units.flatMap((unit, index) =>
            unitMembers[index].map((participantId) => ({
              ...unit,
              participantId,
            })),
          ),
        }
      })
  })

function sumOwed(input: BillCalculationInput) {
  const totals = calculateBillTotals(input)
  return Object.values(totals.byParticipant).reduce(
    (sum, participant) => sum + participant.owedCents,
    0,
  )
}

function claimedCents(input: BillCalculationInput) {
  return input.items.reduce((sum, item) => {
    const claimedUnits = new Set(
      input.assignments
        .filter((assignment) => assignment.itemId === item.id)
        .map((assignment) => assignment.unitIndex),
    ).size
    return sum + claimedUnits * item.unitPriceCents
  }, 0)
}

describe('bill invariants', () => {
  it('bill total is every line plus the tip', () => {
    fc.assert(
      fc.property(arbitraryBill, (input) => {
        const lines = input.items.reduce(
          (sum, item) => sum + item.unitPriceCents * item.quantity,
          0,
        )
        expect(calculateBillTotals(input).billTotalCents).toBe(
          lines + (input.tipCents ?? 0),
        )
      }),
    )
  })

  it('Shares add up to the claimed Units plus the tip, to the cent', () => {
    fc.assert(
      fc.property(arbitraryBill, (input) => {
        expect(sumOwed(input)).toBe(claimedCents(input) + (input.tipCents ?? 0))
      }),
    )
  })

  it('a fully claimed bill is fully shared out', () => {
    fc.assert(
      fc.property(arbitraryBill, (input) => {
        const fullyClaimed = {
          ...input,
          assignments: input.items.flatMap((item) =>
            Array.from({ length: item.quantity }, (_, unitIndex) => ({
              itemId: item.id,
              unitIndex,
              participantId:
                input.assignments.find(
                  (a) => a.itemId === item.id && a.unitIndex === unitIndex,
                )?.participantId ?? input.participants[0].id,
            })),
          ),
        }
        expect(sumOwed(fullyClaimed)).toBe(
          calculateBillTotals(fullyClaimed).billTotalCents,
        )
      }),
    )
  })

  it('balance is Share minus payments, and the Host is never Outstanding', () => {
    fc.assert(
      fc.property(arbitraryBill, (input) => {
        const totals = calculateBillTotals(input)
        for (const { id } of input.participants) {
          const seat = totals.byParticipant[id]
          expect(seat.owedCents).toBeGreaterThanOrEqual(0)
          if (id === input.hostParticipantId) {
            expect(seat).toMatchObject({ balanceCents: 0, status: 'paid' })
            continue
          }
          const paid = input.payments
            .filter((payment) => payment.participantId === id)
            .reduce((sum, payment) => sum + payment.amountCents, 0)
          expect(seat.paidCents).toBe(paid)
          expect(seat.balanceCents).toBe(seat.owedCents - paid)
          expect(seat.status === 'paid').toBe(
            seat.owedCents <= 0 || paid >= seat.owedCents,
          )
        }
      }),
    )
  })

  it('a Participant Share breakdown always matches the bill totals', () => {
    fc.assert(
      fc.property(arbitraryBill, (input) => {
        const totals = calculateBillTotals(input)
        const breakdownInput: BillBreakdownInput = {
          ...input,
          items: input.items.map((item) => ({ ...item, name: item.id })),
        }
        for (const { id } of input.participants) {
          const breakdown = calculateParticipantBreakdown(breakdownInput, id)
          expect(breakdown.owedCents).toBe(totals.byParticipant[id].owedCents)
          expect(
            breakdown.lines.reduce((sum, line) => sum + line.amountCents, 0),
          ).toBe(breakdown.owedCents)
        }
      }),
    )
  })
})
