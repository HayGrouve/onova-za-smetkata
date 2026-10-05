// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TipField } from './tip-field.tsx'
import { writeTipPreference } from '#/lib/tip-preferences-storage.ts'

afterEach(() => {
  localStorage.clear()
})

function renderTip(storedTipCents: number | undefined) {
  const onValidCents = vi.fn()
  render(
    <TipField
      itemsSubtotalCents={2000}
      storedTipCents={storedTipCents}
      value="3,00"
      onValueChange={vi.fn()}
      onValidCents={onValidCents}
    />,
  )
  return onValidCents
}

describe('TipField and the remembered tip', () => {
  it('fills the remembered tip into a bill that has none yet', () => {
    writeTipPreference({ mode: 'percent', percent: 10 })
    expect(renderTip(undefined)).toHaveBeenCalledWith(200)
  })

  it('never overwrites the tip a bill already has when it is reopened', () => {
    writeTipPreference({ mode: 'percent', percent: 10 })
    expect(renderTip(300)).not.toHaveBeenCalled()

    writeTipPreference({ mode: 'custom', customCents: 500 })
    expect(renderTip(300)).not.toHaveBeenCalled()
  })
})
