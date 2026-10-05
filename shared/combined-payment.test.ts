// shared/combined-payment.test.ts
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { COMBINED_PAYMENT_MESSAGES } from './combined-payment-messages'
import {
  participantRemainingCents,
  pricePayRequest,
  validateCombinedPaymentConfirm,
  isAwaitingHostConfirmation,
  holdsCoveredSeats,
  isSoloPaymentRequest,
  getCoveredParticipantIds,
  getCoveredAmountsFromRequest,
} from './combined-payment'
import type { BillTotals, ParticipantTotals } from './bill-calculations'

type ParticipantTotalsInput = Pick<ParticipantTotals, 'owedCents' | 'paidCents'>

function totals(overrides: Record<string, ParticipantTotalsInput>): BillTotals {
  const byParticipant: BillTotals['byParticipant'] = {}
  for (const [id, t] of Object.entries(overrides)) {
    byParticipant[id] = {
      owedCents: t.owedCents,
      paidCents: t.paidCents,
      balanceCents: t.owedCents - t.paidCents,
      status:
        t.paidCents <= 0
          ? 'unpaid'
          : t.paidCents >= t.owedCents
            ? 'paid'
            : 'partial',
    }
  }
  return { billTotalCents: 0, byParticipant }
}

describe('participantRemainingCents', () => {
  it('returns balance for participant', () => {
    const t = totals({ p1: { owedCents: 1000, paidCents: 200 } })
    expect(participantRemainingCents(t, 'p1')).toBe(800)
  })

  it('returns 0 for unknown participant', () => {
    expect(participantRemainingCents(totals({}), 'x')).toBe(0)
  })
})

describe('pricePayRequest', () => {
  const base = {
    payerParticipantId: 'p1',
    coveredPendingIds: new Set<string>(),
    totals: totals({
      p1: { owedCents: 850, paidCents: 0 },
      p2: { owedCents: 1200, paidCents: 0 },
      p3: { owedCents: 650, paidCents: 0 },
    }),
  }
  const price = (input: Partial<Parameters<typeof pricePayRequest>[0]>) =>
    pricePayRequest({ ...base, coveredParticipantIds: [], ...input })
  const refusal = (message: string) => ({ ok: false, message })

  it('prices a payer alone at what they have left', () => {
    expect(price({})).toEqual({
      ok: true,
      payerAmountCents: 850,
      coveredAmountsByParticipant: {},
      coveredAmountCents: 0,
      totalCents: 850,
    })
  })

  it('refuses a payer alone with nothing left', () => {
    expect(
      price({ totals: totals({ p1: { owedCents: 850, paidCents: 850 } }) }),
    ).toEqual(refusal(COMBINED_PAYMENT_MESSAGES.payerNothingOwed))
  })

  it('adds each covered seat at what it has left', () => {
    expect(price({ coveredParticipantIds: ['p2', 'p3'] })).toEqual({
      ok: true,
      payerAmountCents: 850,
      coveredAmountsByParticipant: { p2: 1200, p3: 650 },
      coveredAmountCents: 1850,
      totalCents: 2700,
    })
  })

  it('lets a payer who owes nothing cover someone else', () => {
    expect(
      price({
        coveredParticipantIds: ['p2'],
        totals: totals({
          p1: { owedCents: 850, paidCents: 850 },
          p2: { owedCents: 1200, paidCents: 0 },
        }),
      }),
    ).toMatchObject({ ok: true, payerAmountCents: 0, totalCents: 1200 })
  })

  it('refuses covering oneself, twice, a paid seat, or one paid elsewhere', () => {
    const paidP2 = totals({
      p1: { owedCents: 850, paidCents: 0 },
      p2: { owedCents: 1200, paidCents: 1200 },
    })
    expect(price({ coveredParticipantIds: ['p1'] })).toEqual(
      refusal(COMBINED_PAYMENT_MESSAGES.sameParticipant),
    )
    expect(price({ coveredParticipantIds: ['p2', 'p2'] })).toEqual(
      refusal(COMBINED_PAYMENT_MESSAGES.duplicateCovered),
    )
    expect(price({ coveredParticipantIds: ['p2'], totals: paidP2 })).toEqual(
      refusal(COMBINED_PAYMENT_MESSAGES.coveredAlreadyPaid),
    )
    expect(
      price({
        coveredParticipantIds: ['p2', 'p3'],
        coveredPendingIds: new Set(['p3']),
      }),
    ).toEqual(refusal(COMBINED_PAYMENT_MESSAGES.coveredPendingExists))
  })

  it('a priced request is exactly what its seats have left, to the cent', () => {
    const seat = fc.record({
      owedCents: fc.integer({ min: 1, max: 50_000 }),
      paidFraction: fc.double({ min: 0, max: 0.99, noNaN: true }),
    })
    fc.assert(
      fc.property(seat, fc.array(seat, { maxLength: 6 }), (payer, others) => {
        const seats = [payer, ...others].map((entry, index) => ({
          id: `p${index}`,
          owedCents: entry.owedCents,
          paidCents: Math.floor(entry.owedCents * entry.paidFraction),
        }))
        const result = pricePayRequest({
          payerParticipantId: 'p0',
          coveredParticipantIds: seats.slice(1).map((entry) => entry.id),
          coveredPendingIds: new Set(),
          totals: totals(Object.fromEntries(seats.map((s) => [s.id, s]))),
        })
        if (!result.ok) throw new Error(result.message)
        const left = (s: { owedCents: number; paidCents: number }) =>
          s.owedCents - s.paidCents
        expect(result.totalCents).toBe(
          seats.reduce((sum, entry) => sum + left(entry), 0),
        )
        expect(result.payerAmountCents + result.coveredAmountCents).toBe(
          result.totalCents,
        )
      }),
    )
  })
})

describe('validateCombinedPaymentConfirm', () => {
  it('accepts when snapshotted amounts fit remaining (legacy single covered)', () => {
    const result = validateCombinedPaymentConfirm(
      {
        payerAmountCents: 1250,
        coveredAmountsByParticipant: { p2: 920 },
      },
      {
        payerRemainingCents: 1250,
        coveredRemainingsByParticipant: { p2: 920 },
      },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects when covered already paid', () => {
    const result = validateCombinedPaymentConfirm(
      {
        payerAmountCents: 1250,
        coveredAmountsByParticipant: { p2: 920 },
      },
      {
        payerRemainingCents: 1250,
        coveredRemainingsByParticipant: { p2: 0 },
      },
    )
    expect(result.ok).toBe(false)
  })
})

describe('validateCombinedPaymentConfirm (multi-cover)', () => {
  it('accepts per-participant snapshotted amounts', () => {
    const result = validateCombinedPaymentConfirm(
      {
        payerAmountCents: 850,
        coveredAmountsByParticipant: { p2: 1200, p3: 650 },
      },
      {
        payerRemainingCents: 850,
        coveredRemainingsByParticipant: { p2: 1200, p3: 650 },
      },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects when one covered already paid', () => {
    const result = validateCombinedPaymentConfirm(
      {
        payerAmountCents: 850,
        coveredAmountsByParticipant: { p2: 1200, p3: 650 },
      },
      {
        payerRemainingCents: 850,
        coveredRemainingsByParticipant: { p2: 1200, p3: 0 },
      },
    )
    expect(result.ok).toBe(false)
  })
})

describe('isAwaitingHostConfirmation', () => {
  it('true when pending and transfer initiated', () => {
    expect(
      isAwaitingHostConfirmation({
        status: 'pending',
        transferInitiatedAt: 99,
      }),
    ).toBe(true)
  })

  it('false when pending but not initiated', () => {
    expect(
      isAwaitingHostConfirmation({
        status: 'pending',
        transferInitiatedAt: undefined,
      }),
    ).toBe(false)
  })
})

describe('holdsCoveredSeats', () => {
  it('keeps a reservation while the payer phone is still on the bill', () => {
    expect(holdsCoveredSeats({ status: 'pending' }, true)).toBe(true)
  })

  it('drops a reservation once the payer session is gone', () => {
    expect(holdsCoveredSeats({ status: 'pending' }, false)).toBe(false)
  })

  it('keeps a started transfer until the Host resolves it', () => {
    expect(
      holdsCoveredSeats({ status: 'pending', transferInitiatedAt: 5 }, false),
    ).toBe(true)
  })

  it('never holds seats once resolved', () => {
    expect(
      holdsCoveredSeats({ status: 'cancelled', transferInitiatedAt: 5 }, true),
    ).toBe(false)
  })
})

describe('isSoloPaymentRequest', () => {
  it('true without covered participant', () => {
    expect(isSoloPaymentRequest({})).toBe(true)
  })

  it('false with covered participant array', () => {
    expect(isSoloPaymentRequest({ coveredParticipantIds: ['p2'] })).toBe(false)
  })

  it('false with legacy covered participant', () => {
    expect(isSoloPaymentRequest({ coveredParticipantId: 'p2' })).toBe(false)
  })
})

describe('getCoveredParticipantIds', () => {
  it('reads legacy single id', () => {
    expect(getCoveredParticipantIds({ coveredParticipantId: 'p2' })).toEqual([
      'p2',
    ])
  })

  it('prefers array when present', () => {
    expect(
      getCoveredParticipantIds({
        coveredParticipantIds: ['p2', 'p3'],
        coveredParticipantId: 'p9',
      }),
    ).toEqual(['p2', 'p3'])
  })
})

describe('getCoveredAmountsFromRequest', () => {
  it('reads map when present', () => {
    expect(
      getCoveredAmountsFromRequest({
        coveredAmountsByParticipant: { p2: 100, p3: 200 },
      }),
    ).toEqual({ p2: 100, p3: 200 })
  })

  it('falls back to legacy single covered amount', () => {
    expect(
      getCoveredAmountsFromRequest({
        coveredParticipantId: 'p2',
        coveredAmountCents: 920,
      }),
    ).toEqual({ p2: 920 })
  })
})
