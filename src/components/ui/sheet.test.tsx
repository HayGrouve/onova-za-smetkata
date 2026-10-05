// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Sheet, SheetContent, SheetTitle } from './sheet.tsx'

afterEach(cleanup)

function OpenedFromState() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Плащам и за някого
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetTitle>За кого още отбелязвате?</SheetTitle>
          <button type="button">Боби</button>
        </SheetContent>
      </Sheet>
    </>
  )
}

describe('Sheet opened from state', () => {
  it('gives focus back to the button that opened it', async () => {
    render(<OpenedFromState />)
    const opener = screen.getByRole('button', { name: 'Плащам и за някого' })
    opener.focus()
    fireEvent.click(opener)
    expect(await screen.findByRole('dialog')).toBeTruthy()

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape',
      })
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    // Radix moves focus on close in a timeout after the sheet unmounts.
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })
})
