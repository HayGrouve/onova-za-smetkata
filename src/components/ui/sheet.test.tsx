// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogTitle,
} from './alert-dialog.tsx'
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
    // Safari does not focus a tapped button: only the press says who opened it.
    fireEvent.pointerDown(item)
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

/** A group editor sheet: removing a member asks first, and the row goes away. */
function NestedConfirm() {
  const [members, setMembers] = useState(['Ани', 'Боби'])
  const [confirming, setConfirming] = useState<string | null>(null)
  return (
    <main id="main" tabIndex={-1}>
      <Sheet open onOpenChange={() => {}}>
        <SheetContent side="bottom">
          <SheetTitle>Група</SheetTitle>
          {members.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setConfirming(name)}
            >
              Премахни {name}
            </button>
          ))}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Премахване?</AlertDialogTitle>
          <AlertDialogAction
            onClick={() => {
              setMembers((current) => current.filter((m) => m !== confirming))
              setConfirming(null)
            }}
          >
            Премахни
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

describe('Confirm opened inside a sheet', () => {
  it('keeps focus in the sheet when the row that opened it is removed', async () => {
    render(<NestedConfirm />)
    const sheet = await screen.findByRole('dialog')
    const remove = screen.getByRole('button', { name: 'Премахни Ани' })
    remove.focus()
    fireEvent.click(remove)
    const confirm = await screen.findByRole('alertdialog')

    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Премахни' }))
    })

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Премахни Ани' })).toBeNull()
    await waitFor(() =>
      expect(sheet.contains(document.activeElement)).toBe(true),
    )
  })
})
