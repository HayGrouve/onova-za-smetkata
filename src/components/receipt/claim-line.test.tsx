// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClaimLine } from './claim-line.tsx'
import type { ClaimGroup } from '../../../shared/claim-groups.ts'

const pizza: ClaimGroup = {
  key: 'pizza',
  name: 'Пица',
  unitPriceCents: 1000,
  sortOrder: 0,
  itemIds: ['item-pizza'],
  units: [
    { itemId: 'item-pizza', unitIndex: 0 },
    { itemId: 'item-pizza', unitIndex: 1 },
  ],
}

afterEach(cleanup)

function renderLine(disabled: boolean, onTap = vi.fn()) {
  const ui = (busy: boolean) => (
    <ClaimLine
      group={pizza}
      membersOf={() => []}
      mode="claim"
      tapLabel="Мое"
      disabled={busy}
      onTap={onTap}
    />
  )
  const view = render(ui(disabled))
  return { onTap, rerender: (busy: boolean) => view.rerender(ui(busy)) }
}

describe('ClaimLine while a take is in flight', () => {
  it('keeps keyboard focus on the line so the next key press lands', () => {
    const { rerender } = renderLine(false)
    const line = screen.getByRole('button', { name: /^Мое: Пица/ })
    line.focus()

    rerender(true)

    // Browsers blur a button the moment it becomes `disabled`; jsdom does not,
    // so check the attribute that causes it as well as the focus itself.
    expect((line as HTMLButtonElement).disabled).toBe(false)
    expect(document.activeElement).toBe(line)
    expect(line.getAttribute('aria-disabled')).toBe('true')
  })

  it('ignores taps until the take settles', () => {
    const { onTap, rerender } = renderLine(true)
    const line = screen.getByRole('button', { name: /^Мое: Пица/ })

    fireEvent.click(line)
    expect(onTap).not.toHaveBeenCalled()

    rerender(false)
    fireEvent.click(line)
    expect(onTap).toHaveBeenCalledTimes(1)
  })
})
