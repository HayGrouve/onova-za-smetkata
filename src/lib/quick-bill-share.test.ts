import { describe, expect, it } from 'vitest'
import { formatEur } from '#/lib/format-currency.ts'
import {
  createQuickBill,
  renameQuickBillSeat,
  replaceQuickBillLines,
  summarizeQuickBill,
  takeQuickBillUnit,
} from '../../shared/quick-bill.ts'
import type { QuickBill } from '../../shared/quick-bill.ts'
import { formatQuickBillShareText } from './quick-bill-share.ts'

const NOW = Date.UTC(2026, 9, 5, 19, 30)

function take(bill: QuickBill, lineId: string, seatId: string) {
  const result = takeQuickBillUnit(bill, [lineId], seatId)
  if (!result.ok) throw new Error(result.message)
  return result.bill
}

function tableOfThree() {
  let bill = replaceQuickBillLines(
    createQuickBill({ now: NOW, seatCount: 3 }),
    {
      lines: [
        { name: 'Бира', unitPriceCents: 420, quantity: 1 },
        { name: 'Шопска', unitPriceCents: 900, quantity: 1 },
        { name: 'Хляб', unitPriceCents: 150, quantity: 1 },
      ],
    },
  )
  bill = renameQuickBillSeat(bill, 's1', 'Иван')
  bill = renameQuickBillSeat(bill, 's2', 'Иван')
  bill = take(bill, 'l1', 's1')
  bill = take(bill, 'l2', 's2')
  return bill
}

describe('the quick bill message', () => {
  it('lists what each person owes and leaves out whoever had nothing', () => {
    const bill = tableOfThree()
    const text = formatQuickBillShareText(bill, summarizeQuickBill(bill))
    const lines = text.split('\n')
    expect(lines.filter((line) => line.endsWith(formatEur(420)))).toHaveLength(
      1,
    )
    expect(lines.filter((line) => line.endsWith(formatEur(900)))).toHaveLength(
      1,
    )
    expect(text).not.toContain('Човек 3')
  })

  it('tells two people with the same name apart', () => {
    const bill = tableOfThree()
    const lines = formatQuickBillShareText(bill, summarizeQuickBill(bill))
      .split('\n')
      .filter((line) => line.startsWith('Иван'))
    expect(new Set(lines.map((line) => line.split(':')[0])).size).toBe(2)
  })

  it('says how much nobody took', () => {
    const bill = tableOfThree()
    expect(formatQuickBillShareText(bill, summarizeQuickBill(bill))).toContain(
      formatEur(150),
    )
  })

  it('shows the rounded amounts when rounding for cash', () => {
    const bill = { ...tableOfThree(), roundForCash: true }
    const text = formatQuickBillShareText(bill, summarizeQuickBill(bill))
    expect(text).toContain(formatEur(400))
    expect(text).not.toContain(formatEur(420))
    // What people hand over (13,00 €) next to the bill's own total.
    expect(text).toContain(formatEur(1300))
    expect(text).toContain(formatEur(1470))
  })
})
