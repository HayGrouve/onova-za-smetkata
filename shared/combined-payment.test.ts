// shared/combined-payment.test.ts
import { describe, expect, it } from 'vitest'
import {
  participantRemainingCents,
  validateCombinedPaymentCreate,
  validateCombinedPaymentConfirm,
  isAwaitingHostConfirmation,
  isSoloPaymentRequest,
  validateInitiateTransfer,
  validateSoloPaymentCreate,
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

describe('validateSoloPaymentCreate', () => {
  const baseCtx = {
    payerParticipantId: 'p1',
    hasPendingForSession: false,
    totals: totals({ p1: { owedCents: 1250, paidCents: 0 } }),
  }

  it('accepts payer with remaining balance', () => {
    expect(validateSoloPaymentCreate(baseCtx)).toEqual({
      ok: true,
      payerAmountCents: 1250,
      totalCents: 1250,
    })
  })

  it('rejects zero remaining', () => {
    const result = validateSoloPaymentCreate({
      ...baseCtx,
      totals: totals({ p1: { owedCents: 1250, paidCents: 1250 } }),
    })
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate pending for session', () => {
    const result = validateSoloPaymentCreate({
      ...baseCtx,
      hasPendingForSession: true,
    })
    expect(result.ok).toBe(false)
  })
})

describe('validateInitiateTransfer', () => {
  it('accepts combined pending without transferInitiatedAt', () => {
    expect(
      validateInitiateTransfer({
        status: 'pending',
        coveredParticipantId: 'p2',
        transferInitiatedAt: undefined,
      }),
    ).toEqual({ ok: true })
  })

  it('rejects solo request', () => {
    expect(
      validateInitiateTransfer({
        status: 'pending',
        coveredParticipantId: undefined,
        transferInitiatedAt: undefined,
      }).ok,
    ).toBe(false)
  })

  it('rejects already initiated', () => {
    expect(
      validateInitiateTransfer({
        status: 'pending',
        coveredParticipantId: 'p2',
        transferInitiatedAt: 1,
      }).ok,
    ).toBe(false)
  })
})

describe('isAwaitingHostConfirmation', () => {
  it('true when pending and transfer initiated', () => {
    expect(
      isAwaitingHostConfirmation({ status: 'pending', transferInitiatedAt: 99 }),
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

describe('isSoloPaymentRequest', () => {
  it('true without covered participant', () => {
    expect(isSoloPaymentRequest({})).toBe(true)
  })

  it('false with covered participant', () => {
    expect(isSoloPaymentRequest({ coveredParticipantId: 'p2' })).toBe(false)
  })
})
