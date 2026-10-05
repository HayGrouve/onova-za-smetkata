import { describe, expect, it } from 'vitest'
import { calculateBillTotals } from './bill-calculations'
import {
  buildLiveReceipt,
  buildSeatLedger,
  seatPresenceLabel,
  seatStatus,
} from './live-receipt'
import type { LiveReceiptInput } from './live-receipt'

/** Host, Ани and Боби; two „Бира“ lines (one group) and a shared „Салата“. */
const bill = {
  hostParticipantId: 'host',
  tipCents: 0,
  participants: [
    { _id: 'host', name: 'Цвети', sortOrder: 0 },
    { _id: 'ani', name: 'Ани', sortOrder: 1 },
    { _id: 'bobi', name: 'Боби', sortOrder: 2 },
  ],
  items: [
    {
      _id: 'beer1',
      name: 'Бира',
      quantity: 2,
      sortOrder: 0,
      unitPriceCents: 300,
    },
    {
      _id: 'salad',
      name: 'Салата',
      quantity: 1,
      sortOrder: 1,
      unitPriceCents: 800,
    },
    {
      _id: 'beer2',
      name: 'бира ',
      quantity: 1,
      sortOrder: 2,
      unitPriceCents: 300,
    },
  ],
  assignments: [
    { itemId: 'beer1', participantId: 'ani', unitIndex: 0 },
    { itemId: 'salad', participantId: 'ani', unitIndex: 0 },
    { itemId: 'salad', participantId: 'bobi', unitIndex: 0 },
    { itemId: 'beer2', participantId: 'host', unitIndex: 0 },
  ],
}

function totalsWith(
  payments: Array<{ participantId: string; amountCents: number }>,
  assignments = bill.assignments,
) {
  return calculateBillTotals({
    participants: bill.participants.map((p) => ({
      id: p._id,
      sortOrder: p.sortOrder,
    })),
    items: bill.items.map((i) => ({
      id: i._id,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
    })),
    assignments,
    payments,
    tipCents: bill.tipCents,
    hostParticipantId: bill.hostParticipantId,
  })
}

function receipt(overrides: Partial<LiveReceiptInput> = {}) {
  return buildLiveReceipt({
    ...bill,
    seatMoney: buildSeatLedger({ totals: totalsWith([]), sentRequests: [] }),
    joinedSeatIds: [],
    ...overrides,
  })
}

describe('the lines and the foot of the receipt', () => {
  it('groups identical lines and counts what nobody has taken', () => {
    const live = receipt()

    expect(live.lines.map((line) => [line.name, line.units.length])).toEqual([
      ['Бира', 3],
      ['Салата', 1],
    ])
    expect(live.membersOf({ itemId: 'salad', unitIndex: 0 })).toEqual([
      'ani',
      'bobi',
    ])
    expect(live.subtotalCents).toBe(1700)
    expect(live).toMatchObject({ totalUnits: 4, freeUnits: 1, freeCents: 300 })
  })
})

describe('seats around the table', () => {
  it('lists every seat in table order with its Units and presence', () => {
    const live = receipt({ joinedSeatIds: ['ani'] })

    expect(
      live.seats.map((seat) => [
        seat.name,
        seat.unitCount,
        seatPresenceLabel(seat),
      ]),
    ).toEqual([
      ['Цвети', 1, 'домакин'],
      ['Ани', 2, 'на масата, 2 бр.'],
      ['Боби', 1, 'не е отворил линка'],
    ])
  })

  it('a Sent transfer marks its payer and every seat it covers as waiting', () => {
    const totals = totalsWith([])
    const ledger = buildSeatLedger({
      totals,
      sentRequests: [
        {
          _id: 'r1',
          totalCents: 1100,
          payerParticipantId: 'ani',
          coveredParticipantIds: ['bobi'],
        },
      ],
    })
    const live = receipt({ seatMoney: ledger })

    expect(live.seat('ani')).toMatchObject({
      status: 'pending',
      sent: { requestId: 'r1', payerId: 'ani' },
    })
    expect(live.seat('bobi')?.status).toBe('pending')
    expect(live.seat('host')?.status).toBe('host')
  })

  it('a paid seat is paid, a seat with nothing taken owes nothing', () => {
    const assignments = bill.assignments.filter(
      (a) => a.participantId !== 'bobi',
    )
    const live = receipt({
      assignments,
      seatMoney: buildSeatLedger({
        totals: totalsWith(
          [{ participantId: 'ani', amountCents: 1100 }],
          assignments,
        ),
        sentRequests: [],
      }),
    })

    expect(live.seat('ani')?.status).toBe('paid')
    expect(live.seat('bobi')?.status).toBe('empty')
    expect(live.outstandingCents).toBe(0)
  })

  it('Outstanding counts the Guests only, never the Host', () => {
    const live = receipt()
    expect(live.seat('host')?.remainingCents).toBe(0)
    expect(live.outstandingCents).toBe(
      (live.seat('ani')?.remainingCents ?? 0) +
        (live.seat('bobi')?.remainingCents ?? 0),
    )
  })
})

describe('the Host and a Guest see the same receipt', () => {
  it('statuses agree except for transfers the Guest phone did not send', () => {
    const totals = totalsWith([{ participantId: 'ani', amountCents: 300 }])
    const sentByBobi = {
      _id: 'r2',
      totalCents: 400,
      payerParticipantId: 'bobi',
    }
    const host = receipt({
      seatMoney: buildSeatLedger({ totals, sentRequests: [sentByBobi] }),
    })
    // Ани's phone: the server tells it the money, but not Боби's transfer.
    const anisPhone = receipt({
      seatMoney: buildSeatLedger({ totals, sentRequests: [] }),
    })

    expect(host.seats.map((seat) => seat.status)).toEqual([
      'host',
      'owes',
      'pending',
    ])
    expect(anisPhone.seats.map((seat) => seat.status)).toEqual([
      'host',
      'owes',
      'owes',
    ])
    expect(anisPhone.outstandingCents).toBe(host.outstandingCents)
  })
})

describe('seatStatus', () => {
  it('needs money to owe anything', () => {
    expect(seatStatus({ isHost: false, money: undefined })).toBe('empty')
  })
})
