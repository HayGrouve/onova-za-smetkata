# First-run Host journey prototype

## Purpose

Build a throwaway, interactive prototype that assembles the resolved onboarding decisions into one mobile-first journey. It must answer whether a new Host can move from arrival to sharing a prepared first bill through guidance that feels clear, lightweight, recoverable, and specific enough to become the implementation specification.

The prototype evaluates presentation, not the already-resolved product behavior.

## Route and scope

- Add `/prototype/first-run-host-journey?variant=A`.
- Use the existing application shell, Bulgarian terminology, Tailwind theme, shadcn components, and mobile-first layout conventions.
- Keep all state in memory. Do not read from or mutate Convex.
- Mark the route and components as throwaway prototype code.
- Provide one command that starts the existing Vite application and opens the prototype.

## Journey

1. **Arrival:** show a short welcome surface. Starting activates guidance; dismissing leaves onboarding not started.
2. **Host name:** prefill Username, then Auth name, then `домакин`. Allow editing and validate with the existing person-name rules. Confirmation creates the in-memory bill and saves only an edited suggestion.
3. **Content fork:** offer receipt scanning or manual entry. Teach only the selected path.
4. **Bill details:** require a restaurant name, keep tip visible and optional, and add at least one validly priced item.
5. **Participants:** explain the existing Host participant seat and guide adding at least one Guest.
6. **Allocation:** require every item unit to have at least one participant. Explain equal splitting when multiple participants share a unit.
7. **Review and share:** recommend the interactive Guest invitation link after preparation. Earlier sharing remains possible.
8. **Payment checkpoint:** when no payment method exists, offer `Настрой плащане` and `Сподели без начин на плащане`. Saving a valid method resumes sharing; offline sharing dismisses the checkpoint permanently for the prototype session.
9. **Completion:** complete only after both prepared and successfully shared milestones, in either order. End with a brief handoff about Guest claiming/payment and later Host tracking/finalization.

## Guidance variants

All variants use the same state and journey so they compare only contextual-guidance presentation.

- **A — Inline guide rails (default):** one compact teaching block directly above the next relevant control. It disappears when its outcome is satisfied.
- **B — Context dock:** one persistent bottom helper changes with the current bill state.
- **C — Guided empty states:** teaching is absorbed into labels, empty states, and primary actions.

Option A is the selected direction. It best matches the resolved interaction model and provides the clearest implementation reference. Its copy should borrow Option C's brevity to limit mobile height.

## State model

Use a small, typed reducer with:

- lifecycle: `not-started | active | skipped | completed`;
- current surface and bill-editor step;
- confirmed Host name and whether it was edited;
- selected content route;
- restaurant, items, participants, and unit assignments;
- independent `prepared` and `shared` milestones;
- payment configuration and checkpoint dismissal;
- prototype-only share and scan outcomes used to exercise recovery paths.

Derived selectors determine the next relevant guidance, preparation status, and completion. Do not store a viewed-hints checklist.

## Recovery behavior

- Invalid Host names remain on the name stage with an inline error.
- A failed receipt scan offers retry or manual entry.
- Back navigation preserves entered state.
- Simulated return to the home surface shows `Продължи първата сметка` and does not reopen the welcome.
- Share cancellation or failure leaves onboarding active and retryable.
- Closing payment settings returns to the payment checkpoint.
- Choosing offline sharing records checkpoint dismissal before attempting the share.
- Stopping guidance requires explicit confirmation and is terminal in the prototype session.

## Responsive and accessibility constraints

- Design mobile-first at 320 CSS pixels, then expand the editor without changing task order on desktop.
- Keep all actions keyboard operable with logical focus order and visible focus.
- Use dialog/sheet semantics with predictable close and focus restoration.
- Do not make guidance depend on color, position, icons, hover, or motion.
- Preserve content and actions at 200% zoom.
- Meet WCAG 2.2 target-size requirements and respect reduced motion.

## Prototype controls

- Use the shared development-only variant switcher with URL-stable `A`, `B`, and `C` values and arrow-key cycling.
- Add a compact development-only scenario control for mobile/desktop preview and failure/retry paths.
- Keep controls visually separate from the product UI and hidden in production builds.

## Verification

- Exercise both manual-entry and receipt-scan routes through prepared and shared completion.
- Exercise sharing before preparation and preparation before sharing.
- Exercise share cancellation, share failure, scan failure, payment setup, offline sharing, stopping guidance, and resuming an active guided bill.
- Check variant URL persistence and keyboard cycling.
- Run TypeScript/build and lint diagnostics for edited files.
- Inspect the complete journey at mobile and desktop widths in the browser.

## Handoff

The user evaluates the interactive prototype and chooses the final treatment. The ticket resolution records the verdict, any required implementation refinements, and a link to the prototype source. Production implementation is outside this ticket.
