import { describe, expect, it } from 'vitest'
import {
  buildParticipantShareView,
  formatBreakdownLineSharedText,
  formatBreakdownLineSuffix,
  formatBreakdownLineUnitsText,
  formatParticipantShareSectionText,
  paymentStatusLabel,
} from './participant-share-view'

const sharedBreakdown = {
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
    { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
    { itemId: 'i1', participantId: 'p2', unitIndex: 0 },
    { itemId: 'i2', participantId: 'p1', unitIndex: 0 },
  ],
  tipCents: 600,
}

describe('paymentStatusLabel', () => {
  it('returns Bulgarian labels for each status', () => {
    expect(paymentStatusLabel('unpaid')).toBe('неплатено')
    expect(paymentStatusLabel('partial')).toBe('частично')
    expect(paymentStatusLabel('paid')).toBe('платено')
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
      formatBreakdownLineSuffix(
        {
          kind: 'item',
          label: 'Салата',
          amountCents: 600,
          sharedWithCount: 1,
          sharedWithParticipantIds: ['p2'],
        },
        { p2: 'Мария' },
      ),
    ).toBe(' · споделено с Мария')

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
      formatBreakdownLineSuffix(
        {
          kind: 'item',
          label: 'Бира',
          amountCents: 600,
          units: 2,
          totalUnits: 4,
          sharedWithCount: 1,
          sharedWithParticipantIds: ['p2'],
        },
        { p2: 'Мария' },
      ),
    ).toBe(' · 2 от 4 · споделено с Мария')
  })
})

describe('formatBreakdownLineUnitsText', () => {
  it('returns unit count text or undefined', () => {
    expect(
      formatBreakdownLineUnitsText({
        kind: 'item',
        label: 'Бира',
        amountCents: 400,
        units: 2,
        totalUnits: 4,
      }),
    ).toBe('2 от 4')

    expect(
      formatBreakdownLineUnitsText({
        kind: 'item',
        label: 'Пица',
        amountCents: 600,
        sharedWithCount: 1,
      }),
    ).toBeUndefined()
  })
})

describe('formatBreakdownLineSharedText', () => {
  it('returns shared-with text for UI or undefined', () => {
    expect(
      formatBreakdownLineSharedText(
        {
          kind: 'item',
          label: 'Салата',
          amountCents: 600,
          sharedWithCount: 1,
          sharedWithParticipantIds: ['p2'],
        },
        { p2: 'Мария' },
      ),
    ).toBe('Споделено с Мария')

    expect(
      formatBreakdownLineSharedText({
        kind: 'item',
        label: 'Бира',
        amountCents: 400,
        units: 2,
        totalUnits: 4,
      }),
    ).toBeUndefined()
  })
})

describe('buildParticipantShareView', () => {
  it('assembles totals, status label, and display lines for a participant', () => {
    const view = buildParticipantShareView({
      breakdownInput: sharedBreakdown,
      participantId: 'p1',
      participantLabels: { p2: 'Мария' },
      totals: {
        owedCents: 3900,
        paidCents: 0,
        balanceCents: 3900,
        status: 'unpaid',
      },
    })

    expect(view.statusLabel).toBe('неплатено')
    expect(view.remainingCents).toBe(3900)
    expect(view.isEmpty).toBe(false)
    expect(view.lines).toHaveLength(3)
    expect(view.lines[0]).toMatchObject({
      kind: 'item',
      label: 'Салата',
      sharedText: 'Споделено с Мария',
      suffix: ' · споделено с Мария',
      amountCents: 600,
    })
    expect(view.lines[1]).toMatchObject({
      kind: 'item',
      label: 'Пици',
      amountCents: 2400,
    })
    expect(view.lines[2]).toMatchObject({
      kind: 'tip',
      label: 'Бакшиш (1/2)',
      amountCents: 300,
    })
  })

  it('marks empty allocation', () => {
    const view = buildParticipantShareView({
      breakdownInput: {
        participants: [{ id: 'p1', sortOrder: 0 }],
        items: [
          {
            id: 'i1',
            name: 'Салата',
            unitPriceCents: 1200,
            quantity: 1,
          },
        ],
        assignments: [],
      },
      participantId: 'p1',
      totals: {
        owedCents: 0,
        paidCents: 0,
        balanceCents: 0,
        status: 'paid',
      },
    })

    expect(view.isEmpty).toBe(true)
    expect(view.lines).toEqual([])
    expect(view.statusLabel).toBe('платено')
  })
})

describe('formatParticipantShareSectionText', () => {
  it('formats export lines with amounts and status', () => {
    const view = buildParticipantShareView({
      breakdownInput: sharedBreakdown,
      participantId: 'p1',
      participantLabels: { p2: 'Мария' },
      totals: {
        owedCents: 3900,
        paidCents: 0,
        balanceCents: 3900,
        status: 'unpaid',
      },
    })

    const formatAmount = (cents: number) => `${(cents / 100).toFixed(2)} €`
    const lines = formatParticipantShareSectionText('Иван', view, formatAmount)

    expect(lines[0]).toBe('▸ Иван')
    expect(lines[1]).toContain('Салата · споделено с Мария — 6.00 €')
    expect(lines.at(-1)).toBe(
      '  Дължи 39.00 € · Платено 0.00 € · Остатък 39.00 € — неплатено',
    )
  })
})
