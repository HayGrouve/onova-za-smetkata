// shared/combined-payment.test.ts
import { describe, expect, it } from 'vitest'
import {
  participantRemainingCents,
  validateCombinedPaymentCreate,
  validateCombinedPaymentConfirm,
} from './combined-payment'
import type { BillTotals } from './bill-calculations'

function totals(overrides: Partial<BillTotals['byParticipant']>): BillTotals {
  const byParticipant: BillTotals['byParticipant'] = {}
  for (const [id, t] of Object.entries(overrides)) {
    byParticipant[id] = {
      owedCents: t.owedCents ?? 0,
      paidCents: t.paidCents ?? 0,
      balanceCents: (t.owedCents ?? 0) - (t.paidCents ?? 0),
      status:
        (t.paidCents ?? 0) <= 0
          ? 'unpaid'
          : (t.paidCents ?? 0) >= (t.owedCents ?? 0)
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

describe('validateCombinedPaymentCreate', () => {
  const baseCtx = {
    payerParticipantId: 'p1',
    hasPendingForSession: false,
    coveredHasPending: false,
    totals: totals({
      p1: { owedCents: 1250, paidCents: 0 },
      p2: { owedCents: 920, paidCents: 0 },
    }),
  }

  it('accepts valid payer + covered', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantId: 'p2' },
      baseCtx,
    )
    expect(result).toEqual({
      ok: true,
      payerAmountCents: 1250,
      coveredAmountCents: 920,
      totalCents: 2170,
    })
  })

  it('rejects covered same as payer', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantId: 'p1' },
      baseCtx,
    )
    expect(result.ok).toBe(false)
  })

  it('rejects zero remaining on covered', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantId: 'p2' },
      {
        ...baseCtx,
        totals: totals({
          p1: { owedCents: 1250, paidCents: 0 },
          p2: { owedCents: 920, paidCents: 920 },
        }),
      },
    )
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate pending for session', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantId: 'p2' },
      { ...baseCtx, hasPendingForSession: true },
    )
    expect(result.ok).toBe(false)
  })

  it('rejects when covered already has pending', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantId: 'p2' },
      { ...baseCtx, coveredHasPending: true },
    )
    expect(result.ok).toBe(false)
  })
})

describe('validateCombinedPaymentConfirm', () => {
  it('accepts when snapshotted amounts fit remaining', () => {
    const result = validateCombinedPaymentConfirm(
      { payerAmountCents: 1250, coveredAmountCents: 920 },
      {
        payerRemainingCents: 1250,
        coveredRemainingCents: 920,
      },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects when covered already paid', () => {
    const result = validateCombinedPaymentConfirm(
      { payerAmountCents: 1250, coveredAmountCents: 920 },
      { payerRemainingCents: 1250, coveredRemainingCents: 0 },
    )
    expect(result.ok).toBe(false)
  })
})
