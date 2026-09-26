import { describe, expect, it } from 'vitest'
import { buildPaymentReminder } from './payment-reminder'

const oct12 = new Date(2026, 9, 12).getTime()
const oct3 = new Date(2026, 9, 3).getTime()

describe('buildPaymentReminder', () => {
  it('writes a one-bill reminder with the Guest link', () => {
    const text = buildPaymentReminder(
      {
        name: 'Иван',
        outstandingCents: 2340,
        bills: [
          {
            billId: 'b1',
            restaurantName: 'Механа Крайречна',
            date: oct12,
            outstandingCents: 2340,
          },
        ],
      },
      () => 'https://example.test/bills/b1/join?t=x',
    )
    expect(text).toBe(
      'Здрасти, Иван! За сметката в „Механа Крайречна“ (12 октомври) остава 23,40 €. Може да платиш от линка: https://example.test/bills/b1/join?t=x',
    )
  })

  it('omits the link sentence when there is no link', () => {
    const text = buildPaymentReminder(
      {
        name: 'Мария',
        outstandingCents: 500,
        bills: [
          {
            billId: 'b1',
            restaurantName: '  ',
            date: oct3,
            outstandingCents: 500,
          },
        ],
      },
      () => undefined,
    )
    expect(text).toBe(
      'Здрасти, Мария! За сметката от 3 октомври остава 5,00 €.',
    )
  })

  it('lists every bill and the total for several bills', () => {
    const text = buildPaymentReminder(
      {
        name: 'Иван',
        outstandingCents: 3000,
        bills: [
          {
            billId: 'b1',
            restaurantName: 'Хепи',
            date: oct12,
            outstandingCents: 2000,
          },
          {
            billId: 'b2',
            restaurantName: '',
            date: oct3,
            outstandingCents: 1000,
          },
        ],
      },
      (bill) => (bill.billId === 'b1' ? 'https://example.test/b1' : undefined),
    )
    expect(text.split('\n')).toEqual([
      'Здрасти, Иван! Остават 2 сметки:',
      '• Сметката в „Хепи“ (12 октомври) — 20,00 €: https://example.test/b1',
      '• Сметката от 3 октомври — 10,00 €',
      'Общо 30,00 €. Благодаря!',
    ])
  })
})
