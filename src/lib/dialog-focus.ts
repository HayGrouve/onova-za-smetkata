/**
 * `onOpenAutoFocus` for sheets that should not raise the phone keyboard:
 * focus the sheet itself instead of its first field. Only preventing the
 * default leaves focus on the page behind the overlay, out of reach of Tab.
 */
export function focusContentInsteadOfField(event: Event): void {
  event.preventDefault()
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.focus({ preventScroll: true })
  }
}
