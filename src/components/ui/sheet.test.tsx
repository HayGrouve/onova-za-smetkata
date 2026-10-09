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

/** A menu item that opens a sheet and unmounts with its menu, as in the header ⋮. */
function OpenedFromMenu() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" id="menu-trigger" onClick={() => setMenuOpen(true)}>
        Настройки
      </button>
      {menuOpen ? (
        <div role="menu" aria-labelledby="menu-trigger">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              setOpen(true)
            }}
          >
            Настройки за плащане
          </button>
        </div>
      ) : null}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetTitle>Настройки за плащане</SheetTitle>
        </SheetContent>
      </Sheet>
    </>
  )
}

describe('Sheet opened from a menu item', () => {
  it('gives focus back to the menu button once the item is gone', async () => {
    render(<OpenedFromMenu />)
    const trigger = screen.getByRole('button', { name: 'Настройки' })
    fireEvent.click(trigger)
    const item = screen.getByRole('menuitem', { name: 'Настройки за плащане' })
    item.focus()
    fireEvent.click(item)
    expect(await screen.findByRole('dialog')).toBeTruthy()

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape',
      })
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
