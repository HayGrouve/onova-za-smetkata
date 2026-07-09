import { describe, expect, it } from 'vitest'
import { createConfirmActionState } from './confirm-action-state'

const sample = {
  title: 'Test?',
  description: 'Desc',
  confirmLabel: 'OK',
  cancelLabel: 'Cancel',
  variant: 'destructive' as const,
}

describe('createConfirmActionState', () => {
  it('resolves true on confirm', async () => {
    const state = createConfirmActionState()
    const promise = state.requestConfirm(sample)
    expect(state.getPendingRequest()?.title).toBe('Test?')
    state.resolveConfirm(true)
    await expect(promise).resolves.toBe(true)
    expect(state.getPendingRequest()).toBeNull()
  })

  it('resolves false on cancel', async () => {
    const state = createConfirmActionState()
    const promise = state.requestConfirm(sample)
    state.cancelConfirm()
    await expect(promise).resolves.toBe(false)
  })

  it('supersedes previous pending with false', async () => {
    const state = createConfirmActionState()
    const first = state.requestConfirm(sample)
    const second = state.requestConfirm({ ...sample, title: 'Second?' })
    await expect(first).resolves.toBe(false)
    state.resolveConfirm(true)
    await expect(second).resolves.toBe(true)
  })
})
