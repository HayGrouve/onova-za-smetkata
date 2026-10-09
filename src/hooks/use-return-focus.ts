import { useEffect, useRef } from 'react'

/** How recent a tap or key press must be to count as what opened an overlay. */
const OPENED_BY_WINDOW_MS = 1000

/**
 * The element the user last pressed or tapped, and when. Safari does not
 * focus tapped buttons, and a menu item that opens an overlay can be gone by
 * the time the overlay asks who opened it, so focus alone cannot tell.
 */
let lastPress: { target: Element; at: number } | null = null
let tracking = false

function trackPresses() {
  if (tracking) return
  tracking = true
  const record = (event: Event) => {
    if (event.target instanceof Element) {
      lastPress = { target: event.target, at: performance.now() }
    }
  }
  document.addEventListener('pointerdown', record, true)
  document.addEventListener('keydown', record, true)
}

const PRESSABLE =
  'button, a[href], input, select, textarea, [role="menuitem"], [role="button"], [tabindex]'

/** The element to give focus back to once an overlay opened from `active` closes. */
function openerFor(active: Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement) || active === document.body) return null
  let opener: HTMLElement = active
  // A menu item unmounts with its menu: walk out to the button that opened
  // the menu (Radix labels menu content with its trigger), submenus included.
  const seen = new Set<HTMLElement>([opener])
  for (;;) {
    const menu = opener.closest('[role="menu"]')
    const triggerId = menu?.getAttribute('aria-labelledby')
    const trigger = triggerId ? document.getElementById(triggerId) : null
    if (!trigger || seen.has(trigger)) return opener
    seen.add(trigger)
    opener = trigger
  }
}

/** What opened the overlay now opening: the focused element, or a fresh press. */
function currentOpener(): HTMLElement | null {
  const active = document.activeElement
  if (active && active !== document.body) return openerFor(active)
  if (!lastPress || performance.now() - lastPress.at > OPENED_BY_WINDOW_MS) {
    return null
  }
  return openerFor(lastPress.target.closest(PRESSABLE))
}

/** Another dialog still open under the one closing (`closing` itself excluded). */
function openOuterDialog(closing: EventTarget | null): HTMLElement | null {
  const dialogs = [
    ...document.querySelectorAll<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    ),
  ].filter(
    (dialog) =>
      dialog !== closing &&
      !(closing instanceof Node && dialog.contains(closing)) &&
      dialog.getAttribute('data-state') !== 'closed',
  )
  return dialogs.at(-1) ?? null
}

/**
 * Sheets and dialogs here open from state, not a Radix Trigger, so Radix has
 * no trigger to hand focus back to on close and drops it on the page.
 * `remember` on open, `restore` on close: focus goes back to the opener; when
 * the opener is gone (a slip that changed under it, a removed row), to the
 * dialog still open underneath, else to the page content. With no known
 * opener, Radix keeps its default.
 */
export function useReturnFocus() {
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(trackPresses, [])
  return {
    remember() {
      openerRef.current = currentOpener()
    },
    restore(event: Event) {
      const opener = openerRef.current
      openerRef.current = null
      if (event.defaultPrevented || !opener) return
      // The dialog element itself (Radix makes it focusable), not a field in
      // it: focusing an input would pop the phone keyboard.
      const target = opener.isConnected
        ? opener
        : (openOuterDialog(event.target) ?? document.getElementById('main'))
      if (!target) return
      event.preventDefault()
      target.focus({ preventScroll: true })
    },
  }
}
