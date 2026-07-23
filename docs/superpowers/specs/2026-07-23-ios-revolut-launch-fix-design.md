# iOS Revolut Launch Fix

**Date:** 2026-07-23
**Status:** Approved
**Scope:** Guest shared-bill Revolut action on iOS Safari

## Problem

The guest payment handler waits for a Convex mutation before calling
`window.open`. iOS Safari expires the tap's transient user activation during
that network wait and blocks the Revolut window. Android Chromium remains more
permissive, and the UI currently reports success even when `window.open`
returns `null`.

## Design

Prioritize launching Revolut:

1. Resolve the payment amount and build the Revolut URL synchronously.
2. Call `window.open` directly from the button's click handler, before any
   clipboard or network work.
3. If the open is blocked, report an error and do not record a transfer.
4. If the open succeeds, copy the amount and record the pending transfer.
5. If recording fails, keep Revolut open and surface the existing mutation
   error. The external payment launch takes priority over pending-state
   bookkeeping.

A small browser-side helper will own this ordering and return a typed outcome.
The guest footer remains responsible for domain inputs, URL construction, and
toasts.

## Error handling

- Blocked popup: show a specific error; never show “Отворен Revolut”.
- Recording failure after launch: preserve the existing Convex error toast.
- Successful open and recording: preserve the existing success feedback.

## Testing

- Add a unit regression test with a deferred recording promise and assert that
  the open callback runs before the promise resolves.
- Cover the blocked-open outcome.
- Run the focused tests, lint the changed files, and build the application.
- Keep the existing manual iPhone Safari smoke test as the native-app handoff
  check because Chromium mobile emulation cannot validate iOS Universal Links.

## Out of scope

- Changing the `revolut.me` URL format.
- Adding platform-specific user-agent branches.
- Changing host-side payment actions or pending-transfer data semantics.
