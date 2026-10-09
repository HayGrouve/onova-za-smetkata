import { useEffect, useRef } from 'react'

/**
 * The last element that had focus. A menu item that opens an overlay can be
 * gone (and focus on <body>) by the time the overlay asks who opened it.
 */
let lastFocused: Element | null = null
let tracking = false

function trackFocus() {
  if (tracking) return
  tracking = true
  document.addEventListener(
    'focusin',
    (event) => {
      if (event.target instanceof Element) lastFocused = event.target
    },
    true,
  )
}

/** The element to give focus back to once an overlay opened from `active` closes. */
function openerFor(active: Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement) || active === document.body) return null
  let opener: HTMLElement = active
  // A menu item unmounts with its menu: walk out to the button that opened
  // the menu (Radix labels menu content with its trigger), submenus included.
  for (;;) {
    const menu = opener.closest('[role="menu"]')
    const triggerId = menu?.getAttribute('aria-labelledby')
    const trigger = triggerId ? document.getElementById(triggerId) : null
    if (!trigger || trigger === opener) return opener
    opener = trigger
  }
}

/**
 * Sheets and dialogs here open from state, not a Radix Trigger, so Radix has
 * no trigger to hand focus back to on close and drops it on the page.
 * `remember` on open, `restore` on close: focus goes back to the opener, or
 * to the content when the opener is gone (a slip that changed under it).
 */
export function useReturnFocus() {
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(trackFocus, [])
  return {
    remember() {
      const active = document.activeElement
      openerRef.current = openerFor(
        active && active !== document.body ? active : lastFocused,
      )
    },
    restore(event: Event) {
      const opener = openerRef.current
      openerRef.current = null
      if (event.defaultPrevented) return
      const target = opener?.isConnected
        ? opener
        : document.getElementById('main')
      if (!target) return
      event.preventDefault()
      target.focus({ preventScroll: true })
    },
  }
}
