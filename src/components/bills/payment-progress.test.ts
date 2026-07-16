import { describe, expect, it } from 'vitest'
import type { ParticipantTotals } from '#/lib/bill-calculations.ts'

type ProgressParticipant = { id: string; sortOrder: number }

function countPaymentProgress(
  participants: ProgressParticipant[],
  byParticipant: Record<string, ParticipantTotals>,
  hostParticipantId?: string,
) {
  const progressParticipants = hostParticipantId
    ? participants.filter((p) => p.id !== hostParticipantId)
    : participants
  const totalCount = progressParticipants.length
  const paidCount = progressParticipants.filter(
    (p) => byParticipant[p.id]?.status === 'paid',
  ).length
  return { paidCount, totalCount }
}

describe('PaymentProgress guest-only counting', () => {
  const participants = [
    { id: 'host', sortOrder: 0 },
    { id: 'guest1', sortOrder: 1 },
    { id: 'guest2', sortOrder: 2 },
  ]

  const byParticipant: Record<string, ParticipantTotals> = {
    host: {
      owedCents: 500,
      paidCents: 500,
      balanceCents: 0,
      status: 'paid',
    },
    guest1: {
      owedCents: 500,
      paidCents: 500,
      balanceCents: 0,
      status: 'paid',
    },
    guest2: {
      owedCents: 500,
      paidCents: 0,
      balanceCents: 500,
      status: 'unpaid',
    },
  }

  it('excludes Host from progress when hostParticipantId is set', () => {
    expect(
      countPaymentProgress(participants, byParticipant, 'host'),
    ).toEqual({ paidCount: 1, totalCount: 2 })
  })

  it('counts all participants when hostParticipantId is unset', () => {
    expect(countPaymentProgress(participants, byParticipant)).toEqual({
      paidCount: 2,
      totalCount: 3,
    })
  })
})
