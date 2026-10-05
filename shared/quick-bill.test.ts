import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  QUICK_BILL_SEATS_MAX,
  QUICK_BILL_SEATS_MIN,
  QUICK_BILL_TTL_MS,
  addQuickBillLine,
  createQuickBill,
  isQuickBillExpired,
  isQuickBillUnderway,
  joinQuickBillUnit,
  leaveQuickBillUnit,
  parseQuickBill,
  quickBillReceipt,
  quickBillSeatLabel,
  releaseQuickBillUnit,
  removeQuickBillLine,
  renameQuickBillSeat,
  replaceQuickBillLines,
  setQuickBillLineForEveryone,
  setQuickBillSeatCount,
  shareQuickBillUnit,
  splitQuickBillLeftovers,
  summarizeQuickBill,
  takeQuickBillUnit,
  updateQuickBillLine,
} from './quick-bill'
import type { QuickBill } from './quick-bill'

const NOW = Date.UTC(2026, 9, 5, 19, 30)

function billWith(
  lines: Array<{ name: string; unitPriceCents: number; quantity: number }>,
  seatCount = 3,
): QuickBill {
  return replaceQuickBillLines(createQuickBill({ now: NOW, seatCount }), {
    lines,
  })
}

/** Take a Unit and fail the test if the plan refused. */
function take(bill: QuickBill, lineIds: string[], seatId: string) {
  const result = takeQuickBillUnit(bill, lineIds, seatId)
  if (!result.ok) throw new Error(result.message)
  return result.bill
}

function seatIds(bill: QuickBill) {
  return bill.seats.map((seat) => seat.id)
}

function shareOf(bill: QuickBill, seatId: string) {
  return summarizeQuickBill(bill).seats.find((seat) => seat.id === seatId)
    ?.shareCents
}

describe('seats', () => {
  it('starts with numbered seats, ready to pass around', () => {
    const bill = createQuickBill({ now: NOW, seatCount: 4 })
    expect(bill.seats.map(quickBillSeatLabel)).toEqual([
      'Човек 1',
      'Човек 2',
      'Човек 3',
      'Човек 4',
    ])
  })

  it('shows a typed name and falls back to the number when it is cleared', () => {
    const bill = createQuickBill({ now: NOW, seatCount: 2 })
    const [first] = seatIds(bill)
    const named = renameQuickBillSeat(bill, first, '  Иван ')
    expect(quickBillSeatLabel(named.seats[0])).toBe('Иван')
    const cleared = renameQuickBillSeat(named, first, '   ')
    expect(quickBillSeatLabel(cleared.seats[0])).toBe('Човек 1')
  })

  it('keeps the seat count within the table limits', () => {
    const bill = createQuickBill({ now: NOW, seatCount: 3 })
    expect(setQuickBillSeatCount(bill, 0).seats).toHaveLength(
      QUICK_BILL_SEATS_MIN,
    )
    expect(setQuickBillSeatCount(bill, 999).seats).toHaveLength(
      QUICK_BILL_SEATS_MAX,
    )
  })

  it('adds seats with the next free number', () => {
    const bill = setQuickBillSeatCount(
      createQuickBill({ now: NOW, seatCount: 2 }),
      4,
    )
    expect(bill.seats.map(quickBillSeatLabel)).toEqual([
      'Човек 1',
      'Човек 2',
      'Човек 3',
      'Човек 4',
    ])
    expect(new Set(seatIds(bill)).size).toBe(4)
  })

  it('never drops a seat that already took something', () => {
    const bill = billWith([{ name: 'Бира', unitPriceCents: 300, quantity: 2 }])
    const last = seatIds(bill).at(-1)!
    const taken = take(bill, [bill.lines[0].id], last)
    expect(setQuickBillSeatCount(taken, 2).seats).toHaveLength(3)
  })
})

describe('lines', () => {
  it('replaces the lines from a scan and forgets earlier claims', () => {
    const bill = billWith([{ name: 'Бира', unitPriceCents: 300, quantity: 2 }])
    const taken = take(bill, [bill.lines[0].id], seatIds(bill)[0])
    const rescanned = replaceQuickBillLines(taken, {
      lines: [{ name: 'Шопска', unitPriceCents: 900, quantity: 1 }],
      restaurantName: 'Механа',
      receiptTotalCents: 900,
    })
    expect(rescanned.lines.map((line) => line.name)).toEqual(['Шопска'])
    expect(rescanned.claims).toEqual([])
    expect(rescanned.restaurantName).toBe('Механа')
  })

  it('drops claims on Units a smaller quantity no longer has', () => {
    const bill = billWith([{ name: 'Бира', unitPriceCents: 300, quantity: 3 }])
    const [a, b] = seatIds(bill)
    const lineId = bill.lines[0].id
    const taken = take(take(take(bill, [lineId], a), [lineId], b), [lineId], a)
    const fewer = updateQuickBillLine(taken, lineId, { quantity: 1 })
    expect(fewer.claims).toEqual([
      { itemId: lineId, unitIndex: 0, participantId: a },
    ])
  })

  it('removes a line together with its claims', () => {
    const bill = billWith([
      { name: 'Бира', unitPriceCents: 300, quantity: 1 },
      { name: 'Шопска', unitPriceCents: 900, quantity: 1 },
    ])
    const taken = take(bill, [bill.lines[0].id], seatIds(bill)[0])
    const removed = removeQuickBillLine(taken, bill.lines[0].id)
    expect(removed.lines.map((line) => line.name)).toEqual(['Шопска'])
    expect(removed.claims).toEqual([])
  })

  it('gives every added line its own id', () => {
    const bill = addQuickBillLine(
      addQuickBillLine(createQuickBill({ now: NOW, seatCount: 2 }), {
        name: 'Хляб',
        unitPriceCents: 150,
        quantity: 1,
      }),
      { name: 'Хляб', unitPriceCents: 150, quantity: 1 },
    )
    expect(new Set(bill.lines.map((line) => line.id)).size).toBe(2)
  })
})

describe('claiming on the passed phone', () => {
  it('takes the next free Unit of a Claim group for the seat holding the phone', () => {
    const bill = billWith([
      { name: 'Бира', unitPriceCents: 300, quantity: 1 },
      { name: 'бира ', unitPriceCents: 300, quantity: 1 },
    ])
    const [group] = quickBillReceipt(bill).lines
    const [a, b] = seatIds(bill)
    const twice = take(take(bill, group.itemIds, a), group.itemIds, b)
    expect(shareOf(twice, a)).toBe(300)
    expect(shareOf(twice, b)).toBe(300)
    const third = takeQuickBillUnit(twice, group.itemIds, a)
    expect(third.ok).toBe(false)
  })

  it('gives back the last Unit the seat holds alone', () => {
    const bill = billWith([{ name: 'Бира', unitPriceCents: 300, quantity: 2 }])
    const [a] = seatIds(bill)
    const lineIds = [bill.lines[0].id]
    const released = releaseQuickBillUnit(
      take(take(bill, lineIds, a), lineIds, a),
      lineIds,
      a,
    )
    expect(released.ok && shareOf(released.bill, a)).toBe(300)
  })

  it('shares a Unit with chosen seats and lets a seat join or leave one', () => {
    const bill = billWith([{ name: 'Вино', unitPriceCents: 2000, quantity: 1 }])
    const [a, b, c] = seatIds(bill)
    const lineIds = [bill.lines[0].id]
    const shared = shareQuickBillUnit(bill, lineIds, a, [b])
    if (!shared.ok) throw new Error(shared.message)
    expect(shareOf(shared.bill, a)).toBe(1000)
    expect(shareOf(shared.bill, b)).toBe(1000)

    const unit = { itemId: lineIds[0], unitIndex: 0 }
    const joined = joinQuickBillUnit(shared.bill, unit, c)
    expect([a, b, c].map((id) => shareOf(joined, id))).toEqual([667, 667, 666])

    const left = leaveQuickBillUnit(joined, unit, a)
    expect([a, b, c].map((id) => shareOf(left, id))).toEqual([0, 1000, 1000])
  })
})

describe('„За всички“', () => {
  it('splits a line across every seat, including seats added later', () => {
    const bill = billWith(
      [{ name: 'Хляб', unitPriceCents: 300, quantity: 1 }],
      3,
    )
    const shared = setQuickBillLineForEveryone(bill, bill.lines[0].id, true)
    expect(seatIds(shared).map((id) => shareOf(shared, id))).toEqual([
      100, 100, 100,
    ])
    const grown = setQuickBillSeatCount(shared, 4)
    expect(seatIds(grown).map((id) => shareOf(grown, id))).toEqual([
      75, 75, 75, 75,
    ])
  })

  it('leaves the line out of claiming and clears what was taken from it', () => {
    const bill = billWith([{ name: 'Хляб', unitPriceCents: 300, quantity: 2 }])
    const taken = take(bill, [bill.lines[0].id], seatIds(bill)[0])
    const shared = setQuickBillLineForEveryone(taken, bill.lines[0].id, true)
    expect(shared.claims).toEqual([])
    expect(quickBillReceipt(shared).lines).toEqual([])
  })

  it('turns back into a free line when switched off', () => {
    const bill = billWith([{ name: 'Хляб', unitPriceCents: 300, quantity: 1 }])
    const lineId = bill.lines[0].id
    const off = setQuickBillLineForEveryone(
      setQuickBillLineForEveryone(bill, lineId, true),
      lineId,
      false,
    )
    expect(summarizeQuickBill(off).unassignedCents).toBe(300)
  })
})

describe('summary', () => {
  it('shows what nobody took, until it is split evenly', () => {
    const bill = billWith(
      [
        { name: 'Бира', unitPriceCents: 300, quantity: 2 },
        { name: 'Хляб', unitPriceCents: 150, quantity: 2 },
      ],
      2,
    )
    const [a] = seatIds(bill)
    const taken = take(bill, [bill.lines[0].id], a)
    expect(summarizeQuickBill(taken)).toMatchObject({
      unassignedUnits: 3,
      unassignedCents: 600,
    })

    const split = splitQuickBillLeftovers(taken)
    const summary = summarizeQuickBill(split)
    expect(summary.unassignedCents).toBe(0)
    expect(summary.seats.map((seat) => seat.shareCents)).toEqual([600, 300])
  })

  it('adds the tip as a percent of the lines, split evenly', () => {
    const bill = {
      ...billWith([{ name: 'Вино', unitPriceCents: 3000, quantity: 1 }], 2),
      tipPercent: 10 as const,
    }
    const split = splitQuickBillLeftovers(bill)
    const summary = summarizeQuickBill(split)
    expect(summary.tipCents).toBe(300)
    expect(summary.totalCents).toBe(3300)
    expect(summary.seats.map((seat) => seat.shareCents)).toEqual([1650, 1650])
  })

  it('rounds each total to 0,50 € for cash when asked', () => {
    const bill = billWith(
      [
        { name: 'Бира', unitPriceCents: 420, quantity: 1 },
        { name: 'Кафе', unitPriceCents: 180, quantity: 1 },
      ],
      2,
    )
    const [a, b] = seatIds(bill)
    const claimed = take(
      take(bill, [bill.lines[0].id], a),
      [bill.lines[1].id],
      b,
    )
    expect(
      summarizeQuickBill(claimed).seats.map((seat) => seat.amountCents),
    ).toEqual([420, 180])

    const rounded = summarizeQuickBill({ ...claimed, roundForCash: true })
    expect(rounded.seats.map((seat) => seat.amountCents)).toEqual([400, 200])
    expect(rounded.seats.map((seat) => seat.shareCents)).toEqual([420, 180])
    expect(rounded.amountsTotalCents).toBe(600)
  })

  it('flags lines that do not add up to the printed receipt total', () => {
    const bill = replaceQuickBillLines(createQuickBill({ now: NOW }), {
      lines: [{ name: 'Бира', unitPriceCents: 300, quantity: 2 }],
      receiptTotalCents: 900,
    })
    expect(summarizeQuickBill(bill).receiptMismatch).toEqual({
      linesCents: 600,
      receiptCents: 900,
    })
    const fixed = updateQuickBillLine(bill, bill.lines[0].id, { quantity: 3 })
    expect(summarizeQuickBill(fixed).receiptMismatch).toBeNull()
  })

  it('accounts for every cent: Shares plus what nobody took make the total', () => {
    const lineArb = fc.record({
      unitPriceCents: fc.integer({ min: 1, max: 20_000 }),
      quantity: fc.integer({ min: 1, max: 5 }),
      forEveryone: fc.boolean(),
    })
    fc.assert(
      fc.property(
        fc.array(lineArb, { minLength: 1, maxLength: 6 }),
        fc.integer({ min: QUICK_BILL_SEATS_MIN, max: 8 }),
        fc.constantFrom(0, 10, 15, 20),
        fc.array(fc.nat(), { maxLength: 30 }),
        (lines, seatCount, tipPercent, picks) => {
          let bill = replaceQuickBillLines(
            createQuickBill({ now: NOW, seatCount }),
            {
              lines: lines.map((line, index) => ({
                name: `Ред ${index}`,
                unitPriceCents: line.unitPriceCents,
                quantity: line.quantity,
              })),
            },
          )
          bill = { ...bill, tipPercent }
          lines.forEach((line, index) => {
            if (line.forEveryone) {
              bill = setQuickBillLineForEveryone(
                bill,
                bill.lines[index].id,
                true,
              )
            }
          })
          const groups = quickBillReceipt(bill).lines
          for (const pick of picks) {
            if (groups.length === 0) break
            const group = groups[pick % groups.length]
            const seat = bill.seats[pick % bill.seats.length]
            const result = takeQuickBillUnit(bill, group.itemIds, seat.id)
            if (result.ok) bill = result.bill
          }

          const summary = summarizeQuickBill(bill)
          const shares = summary.seats.reduce(
            (sum, seat) => sum + seat.shareCents,
            0,
          )
          expect(shares + summary.unassignedCents).toBe(summary.totalCents)

          const evened = summarizeQuickBill(splitQuickBillLeftovers(bill))
          expect(evened.unassignedCents).toBe(0)
          expect(
            evened.seats.reduce((sum, seat) => sum + seat.shareCents, 0),
          ).toBe(evened.totalCents)
        },
      ),
    )
  })
})

describe('starting over', () => {
  it('counts a quick bill as underway once anyone marked, named themselves or finished', () => {
    const bill = billWith([{ name: 'Бира', unitPriceCents: 300, quantity: 2 }])
    expect(isQuickBillUnderway(bill)).toBe(false)
    expect(isQuickBillUnderway(take(bill, ['l1'], 's1'))).toBe(true)
    expect(isQuickBillUnderway(renameQuickBillSeat(bill, 's2', 'Ани'))).toBe(
      true,
    )
  })
})

describe('keeping it for a while', () => {
  it('expires a quick bill left untouched for too long', () => {
    const bill = createQuickBill({ now: NOW })
    expect(isQuickBillExpired(bill, NOW + QUICK_BILL_TTL_MS - 1)).toBe(false)
    expect(isQuickBillExpired(bill, NOW + QUICK_BILL_TTL_MS + 1)).toBe(true)
    const touched = { ...bill, updatedAt: NOW + QUICK_BILL_TTL_MS }
    expect(isQuickBillExpired(touched, NOW + QUICK_BILL_TTL_MS + 1)).toBe(false)
  })

  it('reads back what it stored and refuses anything else', () => {
    const bill = take(
      billWith([{ name: 'Бира', unitPriceCents: 300, quantity: 2 }]),
      ['l1'],
      's1',
    )
    expect(parseQuickBill(JSON.parse(JSON.stringify(bill)))).toEqual(bill)
    expect(parseQuickBill({ version: 0 })).toBeNull()
    expect(parseQuickBill('нещо')).toBeNull()
  })
})
