// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentActions } from './payment-actions.tsx'
import type { Id } from '../../../convex/_generated/dataModel'

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
}))

vi.mock('#/components/confirm-action-provider.tsx', () => ({
  useConfirmAction: () => ({ confirm: vi.fn().mockResolvedValue(false) }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const billId = 'bill1' as Id<'bills'>
const participantId = 'p1' as Id<'participants'>

const payment = {
  _id: 'pay1' as Id<'payments'>,
  _creationTime: 0,
  billId,
  participantId,
  amountCents: 500,
  paidAt: 1_700_000_000_000,
}

describe('PaymentActions readOnly after finalize', () => {
  it('shows payment history without undo or mark-paid when readOnly', () => {
    render(
      <PaymentActions
        billId={billId}
        participantId={participantId}
        label="Alice"
        totals={{
          owedCents: 1000,
          paidCents: 500,
          balanceCents: 500,
          status: 'partial',
        }}
        payments={[payment]}
        readOnly
      />,
    )

    expect(screen.getByText('Плащания')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Отмени последно плащане/ }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Платено' })).toBeNull()
  })

  it('shows undo and mark-paid when not readOnly with balance remaining', () => {
    render(
      <PaymentActions
        billId={billId}
        participantId={participantId}
        label="Alice"
        totals={{
          owedCents: 1000,
          paidCents: 500,
          balanceCents: 500,
          status: 'partial',
        }}
        payments={[payment]}
        readOnly={false}
      />,
    )

    expect(
      screen.getByRole('button', { name: /Отмени последно плащане/ }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Платено' })).toBeTruthy()
  })
})
