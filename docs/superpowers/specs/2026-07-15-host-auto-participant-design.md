# Host Auto-Participant & Self-Pay — Design Spec

**Date:** 2026-07-15  
**Status:** Approved  
**Scope:** Saved host display name in payment settings; auto-add host as a bill participant; greyed join-row; editor claim shortcut; host claim footer uses **Плати** (immediate mark-paid) instead of Revolut/IBAN  
**Approach:** 1 — Host participant + claim shortcut  
**Builds on:** `2026-07-07-guest-qr-claim-flow-design.md`, `2026-07-09-payment-settings-validation-design.md`, `2026-07-15-guest-sharing-refactor-design.md`

---

## Problem

The host has already paid the restaurant bill and wants to:

1. Appear on every new bill without manually adding themselves each time.
2. Claim their own items with the same claim UX guests use.
3. Mark their share paid immediately — without Revolut/IBAN transfer UI and without confirming their own payment like a guest transfer.
4. Keep their name visible on the join list so guests know the seat is taken, but prevent guests from picking it.

## Solution

**Моето име** in payment settings. On bill create, auto-insert a participant with that name and store `bills.hostParticipantId`. Join page greys that row. Editor offers **Моите артикули** → claim screen in host mode (owner auth). Footer shows **Плати** only → inserts a normal `payments` row for the host’s remaining balance.

Guests keep Revolut/IBAN and combined-pay flows unchanged. Host still confirms guest transfers on step 4.

## UX decisions

| Topic                   | Choice                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| Host identity storage   | `paymentSettings.hostDisplayName`                                     |
| Auto-add timing         | At bill create only (when name is set)                                |
| Host ↔ bill link        | `bills.hostParticipantId` (not name-string matching)                  |
| Join visibility         | Show host name, greyed, labeled „домакин“, not tappable               |
| Host claim entry        | Editor shortcut **Моите артикули** (Approach A)                       |
| Host pay UI             | **Плати** only — no Revolut, no IBAN, no „Плати и за“                 |
| Host pay effect         | Immediate `payments` insert for remaining; no combined-payment banner |
| Settings rename         | Affects new bills only; does not rewrite existing bills               |
| Backfill existing bills | Out of scope for v1                                                   |

---

## User flows

### Settings — set host name

1. Host opens payment settings.
2. Enters **Моето име** (e.g. „Цветомир“) next to Revolut/IBAN.
3. Saves. Value is private (not exposed to guests).

### Bill create — auto-add

1. Host creates a bill.
2. If `hostDisplayName` is set and non-empty after trim: insert participant with that name; set `bill.hostParticipantId`.
3. If unset: bill has no host participant (current behavior); claim shortcut unavailable until a host participant exists.

### Guest join

1. Guest opens join page.
2. Host participant appears greyed with „домакин“ (or equivalent); not selectable.
3. Other names remain large tap targets as today.

### Host claim + Плати

1. On bill editor (when `hostParticipantId` is set): host taps **Моите артикули**.
2. Claim screen opens in **host mode** bound to `hostParticipantId` (owner auth; no guest session; no switch-identity).
3. Host claims items like a guest (tabs, toggle, units).
4. Footer shows personal remaining + **Плати**.
5. Tap **Плати** → payment for full remaining of host participant → toast e.g. „Маркирано като платено“.
6. Remaining €0 → button disabled / „Платено“.
7. Bill `final` → read-only claim, same as guests.

### Guest claim (unchanged)

- Revolut / IBAN / combined pay as today.
- Host confirms guest transfers on step 4.
- Host’s own **Плати** never creates a pending confirmation for the host.

---

## Data model

### `paymentSettings` (extended)

```
paymentSettings: {
  userId: Id<"users">
  revolutUsername?: string
  iban?: string
  hostDisplayName?: string   // NEW — „Моето име“
  updatedAt: number
}
```

### `bills` (extended)

```
bills: {
  // ...existing fields
  hostParticipantId?: Id<"participants">  // NEW — set at create when name configured
}
```

**Not used for host detection:** matching participant name to `hostDisplayName`. Only `hostParticipantId` drives greying, shortcut, and host-mode claim.

---

## Backend API

### `paymentSettings`

- `get` / upsert: include `hostDisplayName`.
- `getForGuest`: omit `hostDisplayName` (Revolut/IBAN only).
- Validation: same participant-name rules (trim, length, non-empty if provided).

### `bills.create`

- After insert, if owner has `hostDisplayName`: insert participant, patch `hostParticipantId`.
- Participant sort order: host first (`sortOrder: 0`); later guests shift up as needed by existing add logic.

### `participants.remove`

- If removed id === `bill.hostParticipantId`: clear `hostParticipantId`.

### Guest join / `getForGuest`

- Return `hostParticipantId` so the join UI can grey that participant.

### Host claim access

- Assignment mutations already allow bill owner; host mode uses owner auth scoped to `hostParticipantId` (client only toggles that participant; server may optionally reject owner mutations that target a different participant when a dedicated host-claim path is used — YAGNI unless abuse is a concern; v1: rely on existing owner powers + UI scoping).

### `payments.markHostPaid` (recommended thin mutation)

**Args:** `billId`

**Validation:** caller is bill owner; `hostParticipantId` set; bill not blocking payments as today; remaining for host > 0.

**Effect:** `payments.add` equivalent for host remaining only.

**Why:** avoids client passing an arbitrary `participantId` for “self pay”.

---

## Frontend

### Payment settings UI

- Field **Моето име** with short helper: used to auto-add you on new bills.
- Existing Revolut/IBAN fields unchanged.

### Bill editor

- **Моите артикули** when `hostParticipantId` present.
- If name unset: optional secondary CTA to open payment settings (nice-to-have; minimum is hide the shortcut).

### Join page

- Greyed, non-interactive host row + „домакин“ label.
- Do not start a guest session for that id.

### Claim page — host mode

- Same claim route with search `mode=host`. Accepted only when the viewer is the authenticated bill owner and `hostParticipantId` is set; otherwise redirect to the editor (or join).
- Reuse claim item UI; swap footer: **Плати** instead of Revolut/IBAN/combined chips.
- No identity switcher.

### Step 4 summary

- Host participant remains in the payment list (shows paid/unpaid).
- No special hide; no self-confirm banner for host **Плати**.

---

## Edge cases

| Case                             | Behavior                                                  |
| -------------------------------- | --------------------------------------------------------- |
| No `hostDisplayName`             | No auto-add; no claim shortcut                            |
| Host participant removed         | Clear `hostParticipantId`; shortcut gone                  |
| Another participant same name    | Only `hostParticipantId` is greyed                        |
| Плати with €0 remaining          | Disabled / no-op                                          |
| Partial payments already on host | Плати pays remaining only                                 |
| Settings name changed later      | New bills only                                            |
| Finalize                         | Unchanged; host items must be assigned like anyone else’s |
| Friend groups / recent names     | Unrelated; auto-add on create is separate                 |

---

## Out of scope

- Backfilling host onto existing bills after setting the name
- Auto-Плати whenever assignments change
- Hiding host from step 4 payment list
- Syncing settings rename → rename open bills
- Custom unequal host splits beyond existing claim rules

---

## Testing

### Unit

- Payment settings schema accepts/rejects `hostDisplayName`
- `getForGuest` shape excludes `hostDisplayName`
- Create-bill helper: with/without display name → `hostParticipantId` set or absent
- Remove host participant clears `hostParticipantId`

### E2E (Playwright)

- Set host name → create bill → host participant present
- Join: host greyed, cannot select
- Editor shortcut → claim → assign item → Плати → host remaining €0; no Revolut buttons
- Guest still sees Revolut/IBAN and can pay

### Manual

- Rename settings name; create second bill; first bill unchanged
- Remove host from participants; shortcut disappears

---

## Files (expected touch points)

| Area         | Files                                                                                 |
| ------------ | ------------------------------------------------------------------------------------- |
| Schema       | `convex/schema.ts`                                                                    |
| Settings     | `convex/paymentSettings.ts`, `shared/payment-settings-schema.ts`, payment settings UI |
| Bills        | `convex/bills.ts`                                                                     |
| Participants | `convex/participants.ts` (clear host link on remove)                                  |
| Guest join   | `src/routes/bills/$billId/join.tsx`, guest bill query shape                           |
| Claim        | `src/routes/bills/$billId/claim.tsx`, `guest-claim-footer.tsx` (host variant)         |
| Editor       | `src/routes/bills/$billId/index.tsx` (shortcut)                                       |
| Payments     | `convex/payments.ts` (`markHostPaid`)                                                 |
| Tests        | settings schema tests, e2e host claim + join grey                                     |

---

## Verification

- `pnpm run preflight`
- Manual: set name → new bill → claim my items → Плати → guests join without picking host → guest Revolut still works
