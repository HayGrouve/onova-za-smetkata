# Guest QR Claim Flow — Design Spec

**Date:** 2026-07-07  
**Project:** onova-za-smetkata  
**Status:** Approved  
**Builds on:** `docs/superpowers/specs/2026-07-07-personal-bill-splitter-design.md`, `docs/superpowers/specs/2026-07-07-solo-operator-pack-design.md`

## Summary

Extend the bill-splitter so the host can scan a receipt, show a **QR code**, and friends open the bill on their phones, **pick their name from a pre-created list**, **claim what they consumed**, and **pay via Revolut** for their share. The host still sets up the bill, handles stragglers, finalizes, and confirms payments received.

This shifts the product from pure solo-operator to **host + guest phones at the table**, while keeping **no authentication** and reusing existing assignment and payment math.

## Decisions

| Decision        | Choice                                                            |
| --------------- | ----------------------------------------------------------------- |
| Guest identity  | Pick from host’s pre-added participant list                       |
| Guest powers    | Claim items + see personal total + Revolut button                 |
| Host powers     | Setup, QR, live watch, manual fixes, finalize, mark payments      |
| Host workflow   | Setup (OCR + names + QR), then hand off; small fixes only         |
| Finalize timing | When host is ready to leave; host assigns stragglers manually     |
| QR model        | One QR per bill → join page → name picker                         |
| Security        | Trust model (no auth); same as current public Convex deployment   |
| Live dashboard  | Reuse existing editor realtime updates (no separate dashboard v1) |
| After finalize  | Guest view read-only                                              |

## Architecture

```
[Host — Bill Editor]
  ├─ Existing: receipt OCR, participants, items, assignments
  └─ NEW: BillInviteCard → QR + copy link → /bills/$billId/join

[Guest — Join Page]  /bills/$billId/join
  ├─ List participant names as large tap targets
  ├─ Persist choice in localStorage (per billId)
  └─ Navigate → /bills/$billId/claim

[Guest — Claim View]  /bills/$billId/claim
  ├─ Header: restaurant, “Вие сте: {name}”, switch identity link
  ├─ Item list: self-scoped assignment toggles (reuse split rules)
  ├─ Sticky footer: personal owed total + Revolut button
  └─ Read-only when bill.status === 'final'

[Convex — unchanged tables]
  bills, participants, items, itemAssignments, payments, paymentSettings

[Convex — new guards]
  assignments.claimToggle / claimSetUnits (optional wrappers)
  OR reuse assignments.toggle / setUnits with draft-bill check

[Pure TS]
  buildBillJoinUrl(billId) — absolute URL for QR
  getStoredGuestParticipant(billId) / setStoredGuestParticipant(...)
  generate QR client-side (new dependency: qrcode or similar)
```

**Security:** No login. Anyone with the bill URL can read/write the bill (existing behavior). Anyone on the join page can pick any participant name. Acceptable for friends at a table on a private deployment. Document in UI copy: „Използвайте само с хора на масата.“

**Offline:** Unchanged — network required.

## Section 2: Routes & UI

### New routes

| Route                  | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `/bills/$billId/join`  | Name picker; entry point encoded in QR               |
| `/bills/$billId/claim` | Guest claim + pay view (requires stored participant) |

### Join page (`/bills/$billId/join`)

**When shown:** Friend scans QR or opens copied link.

**Content:**

- Bill context: restaurant name (if set), date
- Title: **„Кой сте вие?“**
- Grid/list of participant name buttons (sorted by `sortOrder`)
- If bill is `final`: message „Сметката е приключена“ + link to read-only claim view
- If no participants: „Очаква се домакинът да добави участници“

**On name tap:**

1. Save `{ billId, participantId }` to `localStorage` key `onova-guest-participant`
2. Navigate to `/bills/$billId/claim`

**If already stored for this bill:** auto-redirect to claim view (skip picker).

### Claim view (`/bills/$billId/claim`)

**Guard:** If no stored participant for this bill → redirect to join page.

**Header:**

- Restaurant name, optional date
- **„Вие сте: {label}“** with **„Не съм {name}“** → clears storage, back to join

**Item list** (sorted by `sortOrder`):

- Each row: item name, unit price × qty, line total
- **Qty = 1:** single toggle — tap row or checkbox to claim/unclaim self (uses `assignments.toggle`)
- **Qty > 1:** show unit stepper for self only (uses `assignments.setUnits`); read-only hint if all units assigned to others
- Show subtle indicator when others share the item (e.g. „+2 други“) — read-only, no other names editable

**Sticky footer:**

- **„Вашият дял“** + owed amount (includes tip share via existing `calculateBillTotals`)
- **Revolut** button — `buildRevolutUrl(revolutUsername, owedCents)` from global `paymentSettings`; copy amount to clipboard first (same as host summary)
- Disabled if Revolut username not configured — show „Попитайте домакина за Revolut“

**Draft vs final:**

- `draft`: full claim/unclaim
- `final`: read-only list + totals + Revolut (no toggles)

**Layout:** Mobile-first, `max-w-lg`, safe-area padding, no app header cog/settings (guests don’t need payment settings editor).

### Host: Bill invite card

**Placement:** New card in bill editor **after Participants**, before Items (or after Items if participants empty — show disabled state until ≥1 participant).

**Title:** **„Покани приятели“** (UsersIcon or QrCodeIcon)

**Content:**

- QR code (~200×200px) encoding absolute join URL
- **„Копирай линк“** button
- Short hint: „Приятелите сканират QR кода, избират името си и отбелязват какво са консумирали.“

**Join URL format:**

```
{origin}/bills/{billId}/join
```

Use `window.location.origin` at runtime; for SSR/build safety, read from env `VITE_APP_ORIGIN` if set (optional, fallback to `window.location.origin` on client).

**QR library:** Add lightweight client-side generator (e.g. `qrcode` npm package) — render to `<canvas>` or data URL in `BillInviteCard`.

### Host editor — no structural change

Assignment rows continue to work; Convex subscriptions update as guests claim. Unassigned badge and amber borders unchanged.

## Section 3: Data & backend

### Schema changes

**None required for v1.** Participant identity is client-side `localStorage` only.

### Mutations

**Reuse existing:**

- `assignments.toggle({ itemId, participantId })`
- `assignments.setUnits({ itemId, participantId, units })`

**Add server guards** (in existing handlers or thin wrappers):

- Reject assignment changes when `bill.status === 'final'`
- Verify `participantId` belongs to the same bill as `itemId`
- Verify item belongs to bill (implicit via item lookup)

No new tables. Optional future: `participants.claimedAt` — out of scope v1.

### Queries

**Reuse:** `api.bills.get` for join + claim pages (same payload as editor).

**Optional lightweight query** `bills.getGuestSummary` — returns only fields guests need (restaurant, status, participants, items, assignments, tip). Not required if `bills.get` is acceptable (it is today — public anyway).

### Payment settings

Guests read `paymentSettings` via existing query (or pass `revolutUsername` through bill get). Host configures Revolut username once in settings — guests use host’s handle.

### Tip handling

Unchanged: tip split evenly across all participants in `calculateBillTotals`. Guest footer shows full owed including tip share.

## Section 4: Edge cases & error handling

| Scenario                                | Behavior                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Friend picks wrong name                 | **„Не съм {name}“** → re-pick on join page                                                |
| Two phones pick same name               | Last write wins on assignments; both see same participant view — acceptable; host can fix |
| Guest claims item others also share     | Existing even-split math via `toggle`                                                     |
| Item qty > 1, units exhausted           | Stepper capped; show „X/Y разпределени“                                                   |
| Host edits items while guests claim     | Allowed (draft); realtime sync; guest may see item disappear — rare, host fixes           |
| Host removes participant guest selected | Claim view redirect to join; clear invalid storage                                        |
| Bill deleted                            | Query returns null → „Сметката не е намерена“                                             |
| No Revolut username configured          | Guest Revolut button disabled with hint                                                   |
| OCR not run yet                         | Join/claim still work if items added manually                                             |
| Straggler didn’t claim                  | Host assigns manually in editor before finalize                                           |
| Finalize with unassigned items          | **Blocked** (existing validation) — host must assign all items first                      |
| Bill finalized while guest on page      | UI switches to read-only on next query update                                             |
| Invalid billId in URL                   | Standard not-found message                                                                |

### Validation at finalize (unchanged)

All items assigned, restaurant name set, ≥1 participant, ≥1 priced item. Host handles stragglers **before** tapping finalize.

## Section 5: Testing

### Unit tests (Vitest)

- `buildBillJoinUrl()` — correct path, uses origin helper
- `getStoredGuestParticipant` / `setStoredGuestParticipant` — read/write/clear localStorage
- Server guard: assignment rejected on `final` bill (Convex test or extracted pure validator)

### Manual test plan

1. Host: create bill → OCR → add 3 participants → see QR
2. Guest phone: scan QR → pick name → claim 2 items → see total update
3. Host editor: see assignments appear live
4. Guest: tap Revolut → correct cents amount opens
5. Host: assign straggler’s items → finalize → guest view read-only
6. Guest: „Не съм …“ → re-pick name works

## Out of scope (v1)

- User accounts / auth
- Per-participant invite tokens or PIN
- Guest marks self as paid
- Push notifications (“everyone has claimed”)
- Separate host live dashboard
- Offline / service worker
- QR on summary page (editor only v1)
- Hiding other participants’ names on join page

## File plan (implementation reference)

| Action | File                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| Create | `src/routes/bills/$billId/join.tsx`                                          |
| Create | `src/routes/bills/$billId/claim.tsx`                                         |
| Create | `src/components/bills/bill-invite-card.tsx`                                  |
| Create | `src/components/bills/guest-item-row.tsx`                                    |
| Create | `src/components/bills/guest-claim-footer.tsx`                                |
| Create | `src/lib/bill-join-url.ts`                                                   |
| Create | `src/lib/guest-participant-session.ts`                                       |
| Modify | `src/routes/bills/$billId/index.tsx` — add BillInviteCard                    |
| Modify | `convex/assignments.ts` — final-bill + bill-participant guards               |
| Modify | `package.json` — QR dependency                                               |
| Test   | `src/lib/bill-join-url.test.ts`, `src/lib/guest-participant-session.test.ts` |

## Spec self-review

- [x] No TBD placeholders
- [x] Consistent with prior specs (EUR, Bulgarian UI, no auth, host finalizes)
- [x] Scope bounded to single feature (join + claim + QR + guards)
- [x] Finalize rules explicit: stragglers assigned by host before finalize; validation unchanged
- [x] Guest Revolut uses host’s global username; host confirms payment manually
