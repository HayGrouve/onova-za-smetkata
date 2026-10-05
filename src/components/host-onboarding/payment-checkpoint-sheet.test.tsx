// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaymentCheckpointSheet } from './payment-checkpoint-sheet.tsx'
import { HOST_ONBOARDING_PAYMENT_CHECKPOINT } from '../../../shared/host-onboarding-messages.ts'

const saveSettings = vi.fn()

vi.mock('convex/react', () => ({
  useMutation: () => saveSettings,
}))

vi.mock('#/components/bills/payment-settings-provider.tsx', () => ({
  usePaymentSettings: () => ({ settings: null }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

afterEach(() => {
  cleanup()
  saveSettings.mockReset()
})

describe('PaymentCheckpointSheet „Настрой плащане“', () => {
  it('asks for Revolut or IBAN instead of sharing with neither', () => {
    const onSavedAndShare = vi.fn()
    render(
      <PaymentCheckpointSheet
        open
        onOpenChange={vi.fn()}
        onShareWithoutPayment={vi.fn()}
        onSavedAndShare={onSavedAndShare}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: HOST_ONBOARDING_PAYMENT_CHECKPOINT.setupPrimary,
      }),
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: HOST_ONBOARDING_PAYMENT_CHECKPOINT.saveAndShare,
      }),
    )

    expect(
      screen.getByText(HOST_ONBOARDING_PAYMENT_CHECKPOINT.needOneMethod),
    ).toBeTruthy()
    expect(saveSettings).not.toHaveBeenCalled()
    expect(onSavedAndShare).not.toHaveBeenCalled()
  })
})
