// shared/combined-payment.test.ts
import { describe, expect, it } from 'vitest'
import {
  participantRemainingCents,
  validateCombinedPaymentCreate,
  validateCombinedPaymentConfirm,
  validateUpdateCovered,
  isAwaitingHostConfirmation,
  isSoloPaymentRequest,
  validateInitiateTransfer,
  validateSoloPaymentCreate,
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

describe('validateCombinedPaymentCreate', () => {
  const baseCtx = {
    payerParticipantId: 'p1',
    hasPendingForSession: false,
    coveredPendingIds: new Set<string>(),
    totals: totals({
      p1: { owedCents: 1250, paidCents: 0 },
      p2: { owedCents: 920, paidCents: 0 },
    }),
  }

  it('accepts valid payer + one covered', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantIds: ['p2'] },
      baseCtx,
    )
    expect(result).toEqual({
      ok: true,
      payerAmountCents: 1250,
      coveredAmountsByParticipant: { p2: 920 },
      coveredAmountCents: 920,
      totalCents: 2170,
    })
  })

  it('rejects covered same as payer', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantIds: ['p1'] },
      baseCtx,
    )
    expect(result.ok).toBe(false)
  })

  it('rejects zero remaining on covered', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantIds: ['p2'] },
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
      { coveredParticipantIds: ['p2'] },
      { ...baseCtx, hasPendingForSession: true },
    )
    expect(result.ok).toBe(false)
  })

  it('rejects when covered already has pending', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantIds: ['p2'] },
      { ...baseCtx, coveredPendingIds: new Set(['p2']) },
    )
    expect(result.ok).toBe(false)
  })
})

describe('validateCombinedPaymentCreate (multi-cover)', () => {
  const baseCtx = {
    payerParticipantId: 'p1',
    hasPendingForSession: false,
    coveredPendingIds: new Set<string>(),
    totals: totals({
      p1: { owedCents: 850, paidCents: 0 },
      p2: { owedCents: 1200, paidCents: 0 },
      p3: { owedCents: 650, paidCents: 0 },
    }),
  }

  it('accepts payer + two covered', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantIds: ['p2', 'p3'] },
      baseCtx,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payerAmountCents).toBe(850)
    expect(result.coveredAmountsByParticipant).toEqual({ p2: 1200, p3: 650 })
    expect(result.coveredAmountCents).toBe(1850)
    expect(result.totalCents).toBe(2700)
  })

  it('rejects duplicate covered ids', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantIds: ['p2', 'p2'] },
      baseCtx,
    )
    expect(result.ok).toBe(false)
  })

  it('rejects when any covered has pending', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantIds: ['p2', 'p3'] },
      { ...baseCtx, coveredPendingIds: new Set(['p3']) },
    )
    expect(result.ok).toBe(false)
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

describe('validateUpdateCovered', () => {
  const baseCtx = {
    payerParticipantId: 'p1',
    coveredPendingIds: new Set<string>(),
    totals: totals({
      p1: { owedCents: 850, paidCents: 0 },
      p2: { owedCents: 1200, paidCents: 0 },
      p3: { owedCents: 650, paidCents: 0 },
    }),
    transferInitiatedAt: undefined,
  }

  it('accepts updated covered set', () => {
    const result = validateUpdateCovered(
      { coveredParticipantIds: ['p2', 'p3'] },
      baseCtx,
    )
    expect(result.ok).toBe(true)
  })

  it('rejects after transfer initiated', () => {
    const result = validateUpdateCovered(
      { coveredParticipantIds: ['p2'] },
      { ...baseCtx, transferInitiatedAt: Date.now() },
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
        coveredParticipantIds: ['p2'],
        transferInitiatedAt: undefined,
      }),
    ).toEqual({ ok: true })
  })

  it('accepts legacy combined pending', () => {
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
        coveredParticipantIds: [],
        transferInitiatedAt: undefined,
      }).ok,
    ).toBe(false)
  })

  it('rejects already initiated', () => {
    expect(
      validateInitiateTransfer({
        status: 'pending',
        coveredParticipantIds: ['p2'],
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
