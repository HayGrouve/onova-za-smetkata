import { describe, expect, it } from 'vitest'
import { formatEur } from './format-currency'
import {
  formatBillShareText,
  formatBreakdownLineSuffix,
  formatCopyAmount,
} from './bill-share'

describe('formatCopyAmount', () => {
  it('formats cents as decimal comma without symbol', () => {
    expect(formatCopyAmount(1250)).toBe('12,50')
    expect(formatCopyAmount(0)).toBe('0,00')
  })
})

describe('formatBreakdownLineSuffix', () => {
  it('describes shared and partial unit assignments', () => {
    expect(
      formatBreakdownLineSuffix({
        kind: 'item',
        label: 'Пици',
        amountCents: 600,
        sharedWithCount: 1,
      }),
    ).toBe(' · споделено с 1')

    expect(
      formatBreakdownLineSuffix({
        kind: 'item',
        label: 'Бира',
        amountCents: 400,
        units: 2,
        totalUnits: 4,
      }),
    ).toBe(' · 2 от 4')

    expect(
      formatBreakdownLineSuffix({
        kind: 'item',
        label: 'Бира',
        amountCents: 600,
        units: 3,
        totalUnits: 3,
      }),
    ).toBe(' · 3 от 3')
  })
})

describe('formatBillShareText', () => {
  const breakdown = {
    participants: [
      { id: 'p1', sortOrder: 0 },
      { id: 'p2', sortOrder: 1 },
    ],
    items: [
      {
        id: 'i1',
        name: 'Салата',
        unitPriceCents: 1200,
        quantity: 1,
      },
      {
        id: 'i2',
        name: 'Пици',
        unitPriceCents: 2400,
        quantity: 1,
      },
    ],
    assignments: [
      { itemId: 'i1', participantId: 'p1' },
      { itemId: 'i1', participantId: 'p2' },
      { itemId: 'i2', participantId: 'p1' },
    ],
    tipCents: 600,
  }

  it('includes items, assignees, per-person lines, and payment status', () => {
    const text = formatBillShareText({
      restaurantName: 'Механа',
      date: new Date('2026-07-07T12:00:00'),
      note: 'Вечеря с приятели',
      billTotalCents: 5400,
      breakdown,
      participants: [
        {
          id: 'p1',
          label: 'Иван',
          sortOrder: 0,
          totals: {
            owedCents: 3900,
            paidCents: 0,
            balanceCents: 3900,
            status: 'unpaid',
          },
        },
        {
          id: 'p2',
          label: 'Мария',
          sortOrder: 1,
          totals: {
            owedCents: 1500,
            paidCents: 1500,
            balanceCents: 0,
            status: 'paid',
          },
        },
      ],
    })

    expect(text).toContain('Сметка: Механа')
    expect(text).toContain('Бележка: Вечеря с приятели')
    expect(text).toContain('Артикули')
    expect(text).toContain('Салата')
    expect(text).toContain(`Иван (${formatEur(600)})`)
    expect(text).toContain(`Мария (${formatEur(600)})`)
    expect(text).toContain(`Бакшиш — ${formatEur(600)} (поравно между 2)`)
    expect(text).toContain('▸ Иван')
    expect(text).toContain('▸ Мария')
    expect(text).toContain(`Салата · споделено с 1 — ${formatEur(600)}`)
    expect(text).toContain('неплатено')
    expect(text).toContain('платено')
    expect(text).toContain(`Общо: ${formatEur(5400)}`)
  })

  it('shows unit-based item ownership in the items section', () => {
    const text = formatBillShareText({
      restaurantName: 'Бар',
      date: new Date('2026-07-07T12:00:00'),
      billTotalCents: 1600,
      breakdown: {
        participants: [
          { id: 'p1', sortOrder: 0 },
          { id: 'p2', sortOrder: 1 },
        ],
        items: [
          {
            id: 'i1',
            name: 'Бира',
            unitPriceCents: 400,
            quantity: 4,
          },
        ],
        assignments: [
          { itemId: 'i1', participantId: 'p1', units: 3 },
          { itemId: 'i1', participantId: 'p2', units: 1 },
        ],
      },
      participants: [
        {
          id: 'p1',
          label: 'Иван',
          sortOrder: 0,
          totals: {
            owedCents: 1200,
            paidCents: 0,
            balanceCents: 1200,
            status: 'unpaid',
          },
        },
        {
          id: 'p2',
          label: 'Мария',
          sortOrder: 1,
          totals: {
            owedCents: 400,
            paidCents: 0,
            balanceCents: 400,
            status: 'unpaid',
          },
        },
      ],
    })

    expect(text).toContain('Бира ×4')
    expect(text).toContain(`Иван 3 бр. (${formatEur(1200)})`)
    expect(text).toContain(`Мария 1 бр. (${formatEur(400)})`)
    expect(text).toContain(`Бира · 3 от 4 — ${formatEur(1200)}`)
  })
})
