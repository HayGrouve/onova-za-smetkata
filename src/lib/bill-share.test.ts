import { describe, expect, it } from 'vitest'
import { formatBillShareText, formatCopyAmount } from './bill-share'

describe('formatCopyAmount', () => {
  it('formats cents as decimal comma without symbol', () => {
    expect(formatCopyAmount(1250)).toBe('12,50')
    expect(formatCopyAmount(0)).toBe('0,00')
  })
})

describe('formatBillShareText', () => {
  it('builds bulgarian summary with statuses', () => {
    const text = formatBillShareText({
      restaurantName: 'Механа',
      date: new Date('2026-07-07T12:00:00'),
      billTotalCents: 3000,
      participants: [
        { label: 'Иван', owedCents: 1500, status: 'unpaid' as const },
        { label: 'Мария', owedCents: 1500, status: 'paid' as const },
      ],
    })
    expect(text).toContain('Механа')
    expect(text).toContain('Иван')
    expect(text).toContain('неплатено')
    expect(text).toContain('платено')
  })
})
