# Application Audit — Онова за сметката

**Date:** 2026-07-08
**Reviewers:** Security (pentest), UI/UX, architecture
**Method:** Full read-only review of `convex/**`, `src/**`, schema, auth, guest flows, tests
**Status:** Area A (SEC-1–SEC-7) implemented — see remediation table below

---

## Area A remediation status (2026-07-08)

| ID | Severity | Status | Notes |
|----|----------|--------|-------|
| SEC-1 | 🔴 | ✅ Done | `files.getReceiptUrl({ billId })` replaces arbitrary `storageId`; client updated |
| SEC-2 | 🔴 | ✅ Done | Final bills use same session-locking join UI as draft; no impersonation branch |
| SEC-3 | 🔴 | ✅ Done | Dev auth gated by explicit dev deployment allowlist + prod block; `devMode.test.ts` |
| SEC-4 | 🟡 | ✅ Done | `shareToken` on bills, `?t=` join URLs, backfill mutation, rotate UI |
| SEC-5 | 🟡 | ✅ Done | `generateUploadUrl({ billId })` + 30/hour per-host rate limit |
| SEC-6 | 🟡 | ✅ Done | Per-actor + per-bill claim limits; limits on heartbeat/release/toggle/setUnits |
| SEC-7 | 🟡 | ✅ Documented | Accepted accountless guest identity risk documented in `docs/DEPLOY.md` |

**Deploy follow-up:** After schema deploy, run `npx convex run backfill:shareTokens` on dev and prod.

**Design & plan:** `docs/superpowers/specs/2026-07-08-area-a-security-privacy-design.md`, `docs/superpowers/plans/2026-07-08-area-a-security-privacy.md`

**Next wave (Area B):** `docs/superpowers/specs/2026-07-09-area-b-money-correctness-design.md` — money math consolidation (MON-1–MON-6). **Status:** ✅ Implemented (2026-07-09). Plan: `docs/superpowers/plans/2026-07-09-area-b-money-correctness.md`

**Next wave (Area C):** `docs/superpowers/specs/2026-07-09-area-c-guest-payment-ux-design.md` — Guest & payment UX (UX-1–UX-7). **Status:** ✅ Implemented (2026-07-09). Plan: `docs/superpowers/plans/2026-07-09-area-c-guest-payment-ux.md`

**Next wave:** Area D — ✅ `docs/superpowers/plans/2026-07-09-area-d-lifecycle-correctness.md`

---

## Area C remediation status (2026-07-09)

| ID | Severity | Status | Notes |
|----|----------|--------|-------|
| UX-1 | 🔴 | ✅ Done | `getForGuest` returns `iban`; guest footer copy button |
| UX-2 | 🔴 | ✅ Done | Edit hidden on final; badge `Завършена — само преглед` |
| UX-3 | 🔴 | ✅ Done | 44px targets on assignment/payment controls; `aria-pressed` on chips |
| UX-4 | 🟡 | ✅ Done | `assignEven` + per-item / unassigned batch equal-split UI |
| UX-5 | 🟡 | ✅ Done | Finalize confirm; delete „Отказ“ on summary + bill card |
| UX-6 | 🟡 | ✅ Done | Payment log + `payments.undoLast` |
| UX-7 | 🟡 | ✅ Done | Claim tabs „Остават“ / „Мои“; qty=1 cent-split fix |
| UX-8 | 🟡 | ✅ Done | Honest offline banner; SW static-only (no navigate shell cache) |
| UX-9 | 🟢 | ✅ Done | Labels, Затвори SR, viewport-fit, theme-color, share € format |

---

## Area D remediation status (2026-07-09)

| ID | Severity | Status | Notes |
|----|----------|--------|-------|
| LIF-1 | 🟡 | ✅ Done | `cleanup.run` cron (6h); finalize purges guest sessions |
| LIF-2 | 🟡 | ✅ Done | `payments.undoLast` (Area C UX-6) |
| LIF-3 | 🟡 | ✅ Done | Throw `ConvexError` on missing entities; payments participant check |
| LIF-4 | 🟢 | ✅ Done | `convex/lib/money.ts`; `by_participantId`; removed `by_status` |

**Next wave:** All audit areas complete (ARC-6 deferred by design).

---

## Area E remediation status (2026-07-09)

| ID | Severity | Status | Notes |
|----|----------|--------|-------|
| ARC-1 | 🟡 | ✅ Done | Denormalized list summary on `bills`; `touchBill` refresh; `listWithSummary` O(1) |
| ARC-2 | 🟢 | ✅ Done | `listRecentNames` capped at 24 recent bills |
| ARC-3 | 🟢 | ✅ Done | `convex/lib/billListSummary.ts`; thin `bills.ts` |
| ARC-4 | 🟢 | ✅ Done | `useReceiptScan` hook extracted from bill editor |
| ARC-5 | 🟢 | ✅ Done | `by_itemId_participantId` index; upsert in `setUnits`; dedupe backfill |
| ARC-6 | 🟢 | ⏸ Deferred | Audit log / soft deletes / multi-currency — product decision |

**Deploy follow-up:** `npx convex run backfill:refreshBillListSummaries` once after schema deploy (optional: `backfill:dedupeAssignments`).

**Design & plan:** `docs/superpowers/specs/2026-07-09-area-e-architecture-scalability-design.md`, `docs/superpowers/plans/2026-07-09-area-e-architecture-scalability.md`

---

## Area B remediation status (2026-07-09)

| ID | Severity | Status | Notes |
|----|----------|--------|-------|
| MON-1 | 🔴 | ✅ Done | `shared/bill-calculations.ts`; `listWithSummary` uses `calculateBillTotals` |
| MON-2 | 🔴 | ✅ Done | Single `validateBillForFinalize`; `assertBillCanFinalize` throws `ConvexError` |
| MON-3 | 🟡 | ✅ Done | `normalizeItemAssignmentModes` on write; optional backfill |
| MON-4 | 🟡 | ✅ Done | `syncEvenAssignments` cent-split for qty=1 (backend only) |
| MON-5 | 🟡 | ✅ Done | Block quantity decrease when units exceed new qty |
| MON-6 | 🟢 | ✅ Done | Reconciliation tests; `payments.add` validation |

**Deploy follow-up:** `npx convex run backfill:normalizeAssignmentModes` once after deploy (optional, idempotent).

---

## How to use this document

Findings are grouped by area. **Area A (Security & Privacy) is the recommended starting point.** Within each area, findings are ordered by severity. Each finding has a stable ID (e.g. `SEC-1`) so you can reference it from specs and task tickets.

Every finding includes: **severity**, **evidence** (file/line), **why it matters**, and a **recommended fix**. A suggested task breakdown is at the end of each area.

Severity legend:

| Level | Meaning |
|-------|---------|
| 🔴 High | Concrete risk (security, data loss, money error) — fix before further growth |
| 🟡 Medium | Real problem or notable gap — fix soon or explicitly accept |
| 🟢 Low | Polish / hardening / future-proofing |

---

## Executive summary

The app is a well-scoped bill-splitter MVP with a normalized schema, integer-cent money handling, a clean host/guest API split, and a solid guest-claim flow. The host write-path authorization is genuinely well done: every host mutation funnels through `requireBillOwner`, and guest writes are constrained to the caller's own participant.

The problems cluster in three places:

1. **The security model treats `billId` as a secret** without making that an explicit, revocable design. One real IDOR (`files.getUrl`), a finalized-bill impersonation gap, and a fail-open dev-auth gate are the highest-priority items.
2. **Money logic is correct but duplicated three times** with no global reconciliation test — "correct by luck, not by construction."
3. **UX gaps undercut trust** in the guest/payment flow (IBAN never shown to guests, no equal-split shortcut, sub-44px touch targets, unclear finalize/edit states).

The single most important decision: **decide whether bills are secret-by-URL (capability links) or truly access-controlled**, then implement that deliberately. Everything in Area A depends on this choice.

---

# Area A — Security & Privacy (recommended first)

## SEC-1 🔴 Cross-tenant file disclosure via `files.getUrl` (IDOR)

**Remediation (2026-07-08):** ✅ Replaced with `files.getReceiptUrl({ billId })`; removed arbitrary `storageId` from client API.

**Evidence:** `convex/files.ts:13-19`

```ts
export const getUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    await requireAuth(ctx)
    return await ctx.storage.getUrl(args.storageId)
  },
})
```

**Why it matters:** Any authenticated host can retrieve a signed URL for **any** storage object by ID — there is no check that the file belongs to a bill the caller owns. Receipt images can contain diner names, card tails, totals, addresses. Storage IDs are also shipped to clients (`bills.getForGuest` returns the full `bill` doc including `receiptStorageId`), widening where an ID can leak.

**Recommended fix:** Do not accept an arbitrary `storageId`. Accept a `billId`, load it via `requireBillOwner`, and return `ctx.storage.getUrl(bill.receiptStorageId)` only. For guest receipt viewing (if desired), gate behind the same share-token decision in SEC-4.

---

## SEC-2 🔴 Finalized bills allow participant impersonation (privacy)

**Remediation (2026-07-08):** ✅ Unified join UI with session locking for all bill statuses; removed final-bill bypass in claim handler.

**Evidence:** `src/routes/bills/$billId/join.tsx:139-163` (all names clickable when `status === 'final'`; `takenParticipantIds` logic skipped); heartbeat disabled on final in `src/routes/bills/$billId/claim.tsx:73`.

**Why it matters:** On a finalized bill, anyone with the link can select **any** diner's name and view that person's breakdown and payment status. The share link stops being "read the bill" and becomes "impersonate any diner." Finalize is exactly when payment-status data (who still owes) becomes sensitive.

**Recommended fix:** Keep session locking on finalized bills, OR require a per-person token/link, OR require a PIN to view an individual breakdown. Tie this to the SEC-4 decision.

---

## SEC-3 🔴 Dev password provider fails open

**Remediation (2026-07-08):** ✅ Dev auth gated by explicit dev deployment allowlist; prod slugs always blocked. See `convex/lib/devMode.test.ts`.

**Evidence:** `convex/auth.ts:31-42`, `convex/lib/devMode.ts:8-26`

```ts
if (isDevModeEnabled()) {
  providers.push(
    Password({
      profile: () => ({ email: DEV_USER_EMAIL, name: DEV_USER_NAME, emailVerified: true }),
      validatePasswordRequirements: () => {},
    }),
  )
}
```

`isDevModeEnabled()` returns `true` when `DEV_MODE === 'true'` **unless** the deployment slug is in a hardcoded prod allowlist (`coordinated-warbler-782` + optional `CONVEX_PROD_DEPLOYMENT`).

**Why it matters:** Fixed credentials (`dev@local.test` / `devpassword`) with disabled password validation and client auto-sign-in. The gate is allowlist-by-exclusion: deploy to a new prod deployment whose slug isn't listed, with `DEV_MODE=true` set or leaked, and anyone can sign in as a fixed account → full host takeover. Safe default should be "dev disabled unless proven-dev."

**Recommended fix:** Invert the gate to an explicit allowlist of known **dev** deployments, or require an explicit `ALLOW_DEV_AUTH` secret set only locally. Never ship a fixed-credential provider enabled by a negative check.

---

## SEC-4 🟡 `billId` used as the security capability (no scoping, no revocation)

**Remediation (2026-07-08):** ✅ `shareToken` on bills; guest APIs require `?t=`; rotatable from invite card; `backfill:shareTokens` for existing bills.

**Evidence:** `convex/bills.ts:192-225` (`getForGuest`), `convex/paymentSettings.ts:20-35` (`getForGuest` returns `revolutUsername`).

**Why it matters:** Anyone with a `billId` gets full bill structure (participant names = PII) and the owner's Revolut handle, with **no session, no rate limit, no revocation, no per-share scoping**. This is the intended capability-URL model, so it's not a straight bug — but the raw document ID is being used as a permanent, unauditable secret. There is no way to revoke a leaked link short of deleting the bill.

**Recommended fix:** Introduce an explicit per-bill **share token** (random secret, stored on the bill, rotatable). `getForGuest` and join require the token, not the raw ID. This makes the capability model deliberate and revocable. This is the anchor decision for SEC-1, SEC-2, and SEC-6.

---

## SEC-5 🟡 Unrestricted uploads via `generateUploadUrl`

**Remediation (2026-07-08):** ✅ Uploads require `billId` + ownership; 30/hour rate limit per host.

**Evidence:** `convex/files.ts:5-11`

**Why it matters:** Any authenticated user can mint upload URLs and push arbitrary files (no size/type/count/bill-scoping limits) into Convex storage — a storage-cost/DoS vector, and uploaded blobs are readable through the SEC-1 IDOR. No per-user rate limiting.

**Recommended fix:** Rate-limit uploads per user; validate/enforce content type + size; associate uploads with a bill the user owns.

---

## SEC-6 🟡 Missing rate limits on guest mutations; claim limit enables lockout

**Remediation (2026-07-08):** ✅ Per-actor + per-bill claim limits; limits on heartbeat, release, toggle, setUnits.

**Evidence:** `convex/guestSessions.ts:61-67` — `claim` limited 40/min **per bill** (shared counter). `assignments.toggle`, `assignments.setUnits`, `guestSessions.heartbeat`, `guestSessions.release` have no limits.

**Why it matters:** A single griefer sending 40 claims/min exhausts the shared per-bill bucket and blocks **legitimate** guests from joining (`assertRateLimit` throws for everyone once the counter is hit). Unthrottled assignment/heartbeat mutations can be hammered by a session holder.

**Recommended fix:** Key the claim limit by client/IP **and** bill (so one client can't lock out others); add modest limits to the other guest mutations.

---

## SEC-7 🟡 Guest identity is claimable → assignment tampering

**Remediation (2026-07-08):** ✅ Documented as accepted accountless design risk in `docs/DEPLOY.md` (no code change — inherent to product model).

**Evidence:** `convex/lib/guestSession.ts:1-9` (90s TTL); `convex/guestSessions.ts` claim flow.

**Why it matters:** Guest sessions are unauthenticated; the credential is a client-generated token. If a legitimate guest's heartbeat lapses for 90s (backgrounded tab, flaky network), an attacker can seize that participant and alter their assignments via `assignments.toggle`/`setUnits`, changing who owes what. Guards correctly restrict a guest to their own participant — but "own" is just "whoever grabbed the name last."

**Recommended fix:** Largely inherent to the accountless design; document as accepted risk. Mitigations: host can lock the roster once claimed; lengthen takeover window / require host approval to re-claim; add an assignment-change audit trail.

---

### Area A — suggested tasks

1. **SEC-1:** Rewrite `files.getUrl` to take `billId` + `requireBillOwner`; update all callers.
2. **SEC-3:** Invert `isDevModeEnabled()` to a dev allowlist / explicit `ALLOW_DEV_AUTH`; add a test asserting dev provider is absent on unknown deployments.
3. **SEC-4:** Add `shareToken` to `bills`; generate on create + backfill; require it in `getForGuest`, `paymentSettings.getForGuest`, and join/claim routes; add rotate mutation.
4. **SEC-2:** Keep session-locking on finalized bills (or per-person token from SEC-4).
5. **SEC-5:** Add upload rate limit + content-type/size validation.
6. **SEC-6:** Re-key claim rate limit by client+bill; add limits to guest mutations.
7. **SEC-7:** Document accepted risk; optional roster lock after finalize.

---

# Area B — Money correctness

## MON-1 🔴 Split logic triplicated; dashboard can diverge from summary

**Evidence:** `src/lib/bill-calculations.ts`; duplicated inline in `convex/bills.ts:106-164` (`listWithSummary`); separate `convex/lib/splitUnits.ts`.

**Why it matters:** The home dashboard's "outstanding" figure is computed by a second copy of the split algorithm. After any change to the math, the dashboard can silently disagree with the summary/claim pages. Three implementations, one behavior — guaranteed to drift.

**Recommended fix:** One shared calculation module imported by both client and Convex (or have `listWithSummary` call a Convex query using the shared lib). Add a regression test comparing all consumers.

---

## MON-2 🔴 `validateBillForFinalize` duplicated (client + server)

**Evidence:** `src/lib/bill-calculations.ts:281-346` vs `convex/lib/validateBillForFinalize.ts` (identical logic).

**Why it matters:** Client preview and server finalize can drift, so the UI may say a bill is finalizable when the server disagrees (or vice versa).

**Recommended fix:** Single implementation in `convex/lib/`; re-export to the client via a shared path; one test suite.

---

## MON-3 🟡 Dual split semantics (units vs cents) can lose cents when mixed

**Evidence:** `src/lib/bill-calculations.ts:93-103` — `usesUnits = some(assignment.units defined)`.

**Why it matters:** If one item has some assignments with `units` and some without, the unit path ignores the cent-split assignees → **lost cents**. Two models coexist with an implicit switch.

**Recommended fix:** Disallow mixed mode — normalize on write, or treat a missing `units` as an even-split share when others have units.

---

## MON-4 🟡 `assignAll` gives a whole qty=1 item to one person

**Evidence:** `convex/assignments.ts:49-60,180-210` — uses `splitUnits(quantity, n)`; `splitUnits(1, 3) → [1,0,0]`.

**Why it matters:** A bulk "split evenly" on a qty=1 item assigns 100% to the first participant by sortOrder, not €X/N each. `assignAll` is currently **not wired into the UI** (grep shows no caller) — so this is a latent bug waiting to be exposed.

**Recommended fix:** For qty=1, use cent-split assignments (no `units`). Fix before exposing in UI, or remove `assignAll` until implemented correctly.

---

## MON-5 🟡 Item quantity edits don't rebalance assignments

**Evidence:** `convex/items.ts:33-58` — patch only.

**Why it matters:** Reducing quantity can leave `assignedUnits > quantity` until manually fixed → totals temporarily wrong.

**Recommended fix:** On quantity change, clamp/rebalance assignments, or block with a clear error.

---

## MON-6 🟢 No global reconciliation test; overpayment uncapped

**Evidence:** Tests cover cases but not `sum(owed) === billTotalCents` post-finalize (`bill-calculations.test.ts:206-217` only checks per-participant breakdown). `payments.add` has no positivity/cap check.

**Why it matters:** Subtle cent regressions go undetected; a host can record a €100 payment against a €5 debt with no undo.

**Recommended fix:** Add a property/fuzz test over randomized valid bills asserting exact reconciliation, including €10.00 and €10.01 ÷ 3. Validate `amountCents > 0`; consider a cap; add a correction path (see LIF-2).

---

### Area B — suggested tasks

1. **MON-1 + MON-2:** Create one shared calc/validate module; delete inline `bills.ts` duplicate and client `validateBillForFinalize`; wire all consumers.
2. **MON-6:** Add reconciliation + remainder edge-case tests.
3. **MON-3 + MON-4:** Decide qty=1 semantics (exclusive vs equal); normalize split model; fix/remove `assignAll`.
4. **MON-5:** Rebalance assignments on quantity change.

---

# Area C — Guest & Payment UX

## UX-1 🔴 IBAN configured by host but never shown to guests

**Evidence:** Host UI offers "Revolut / IBAN" (`src/components/bills/payment-settings-sheet.tsx`); guest API returns only `revolutUsername` (`convex/paymentSettings.ts` `getForGuest`); guest footer shows Revolut only (`src/components/bills/guest-claim-footer.tsx:181-188`).

**Why it matters:** A host who configures IBAN expects guests to bank-transfer; guests never see it and are told "ask the host." Broken promise + friction at exactly the payment step.

**Recommended fix:** Return and display IBAN (with copy button) on the guest footer when set; or remove IBAN from the host promise. (Note SEC-4: exposing payment details to guests should ride on the share-token decision.)

---

## UX-2 🔴 "Edit" stays visible on finalized bills with no explanation

**Evidence:** `src/routes/bills/$billId/summary.tsx:345-355` — "Редактирай" always visible; only finalize is draft-gated. Guest claim goes `readOnly` on final.

**Why it matters:** Host expects a lock after finalize; tapping edit either fails server-side or silently confuses. Product state is ambiguous.

**Recommended fix:** If finalize locks editing, hide/disable edit and badge "Завършена — само преглед." If edits are allowed, rename to "Коригирай" and show what remains editable.

---

## UX-3 🔴 Touch targets below 44px on core assignment controls

**Evidence:** `src/components/bills/assignment-row.tsx` — chips `h-8` (32px), +/- buttons `size-6` (24px); participant remove `size-7`; `ParticipantPayActions` `size="sm"`.

**Why it matters:** The central interaction (assigning items, adjusting quantities) is done one-handed at a table; sub-44px targets fail WCAG 2.5.5 and mobile HIG, causing mis-taps.

**Recommended fix:** Minimum 44×44px hit area via padding (`min-h-11 min-w-11`); keep visual size smaller if desired.

---

## UX-4 🟡 No "split equally between everyone" shortcut

**Evidence:** Tip splits equally (`src/lib/bill-calculations.ts:119-128`); items require per-item chip assignment only.

**Why it matters:** "We all shared everything" is the most common real-world case and currently costs N×M taps.

**Recommended fix:** Add "Раздели поравно между всички" at item-row and bill level.

---

## UX-5 🟡 Finalize has no confirmation; delete dialogs lack explicit Cancel

**Evidence:** `summary.tsx:334-342` (single-tap finalize); `summary.tsx:363-381`, `src/components/bills/bill-card.tsx:137-145` (destructive confirm only, no Cancel button).

**Why it matters:** Finalize is effectively irreversible for guests; easy mis-tap after scrolling. Mobile users expect an explicit "Отказ."

**Recommended fix:** Confirmation dialog for finalize (summarize total + unpaid count, explain guest lock); add explicit Cancel to delete dialogs.

---

## UX-6 🟡 Mark-paid has no undo / payment history

**Evidence:** `src/components/bills/payment-actions.tsx` — `addPayment` only; no list or revert.

**Why it matters:** A mis-tapped "Платено" is hard to correct; no audit trail at the table.

**Recommended fix:** Per-participant payment log + "Отмени последно плащане" or an edit sheet. (Pairs with LIF-2.)

---

## UX-7 🟡 Claimed items disappear from the guest list

**Evidence:** `src/lib/guest-claim-items.ts` `filterUnclaimedGuestClaimItems`; claim route renders only `visibleItems`.

**Why it matters:** After checking items, the list shows "Всички артикули са отбелязани" and the user must discover the footer breakdown to review/uncheck.

**Recommended fix:** Tabs "Остават" / "Мои", or show claimed items collapsed with checkmarks.

---

## UX-8 🟡 Offline PWA overpromises

**Evidence:** `src/components/layout/offline-banner.tsx` ("Приложението изисква мрежа"); `public/sw.js` precaches shell/static only; Convex queries need network.

**Why it matters:** Installed PWA feels broken offline; SW presence implies partial offline support that doesn't exist.

**Recommended fix:** Either cache a last-bill snapshot for read-only guest view, or soften SW scope + messaging.

---

## UX-9 🟢 A11y and formatting polish

**Evidence & items:**
- Assignment chips lack `aria-pressed` (`assignment-row.tsx:77-84`).
- Sticky totals opener unlabeled (`src/components/bills/sticky-totals-bar.tsx:93-96`).
- Login email has no label (`src/routes/login.tsx:111-118`); item inputs placeholder-only (`item-list.tsx`).
- English SR strings: `src/components/ui/sheet.tsx:78`, `dialog.tsx:114`, `receipt-scan-review-sheet.tsx:166` ("Close").
- `viewport-fit=cover` missing (`src/routes/__root.tsx:59`); `theme-color` fixed dark (`__root.tsx:63`).
- Share amount format (`12,50 EUR` in `src/lib/bill-share.ts`) differs from UI `formatEur` (`12,50 €`).
- Hardcoded English errors: `src/routes/bills/$billId/index.tsx:255-261` ("Upload failed").

**Recommended fix:** Batch as a single a11y/i18n polish pass; centralize "Затвори"; add labels + `aria-pressed`/`aria-expanded`; unify formatter.

---

### Area C — suggested tasks

1. **UX-1:** Surface IBAN to guests (behind SEC-4 token).
2. **UX-2:** Resolve finalize/edit lock semantics + badge.
3. **UX-3:** Enforce 44px hit areas on assignment controls.
4. **UX-4:** Equal-split shortcut (item + bill level).
5. **UX-5:** Finalize confirm + delete Cancel buttons.
6. **UX-6:** Payment history + undo.
7. **UX-7:** Keep claimed items visible (tabs/collapsed).
8. **UX-8:** Align offline behavior with messaging.
9. **UX-9:** A11y + i18n + formatting polish pass.

---

# Area D — Data lifecycle & correctness

## LIF-1 🟡 Unbounded growth of auxiliary tables

**Evidence:** `rateLimitBuckets` — unique keys (every bill × endpoint) accumulate forever; window reset only deletes on same-key reuse (`convex/lib/rateLimit.ts:17-19`). Expired `guestSessions` purged only on next `claim` for that bill (`convex/guestSessions.ts:9-22`). Multiple `receiptScans` per bill accumulate on rescans.

**Why it matters:** Steady unbounded growth of rows that are never read again — cost and clutter.

**Recommended fix:** Convex cron: purge guest sessions older than TTL, rate-limit buckets older than max window, receipt scans in terminal state older than N days. Purge/anonymize sessions on finalize.

---

## LIF-2 🟡 Payments are append-only with no correction path

**Evidence:** `convex/payments.ts` — `add` only; delete only via bill/participant removal.

**Why it matters:** A recording mistake is permanent; no audit or reversal.

**Recommended fix:** Add owner-only `payments.remove` (or adjustment) with an audit note. Pairs with UX-6.

---

## LIF-3 🟡 Silent no-ops and missing linkage checks in mutations

**Evidence:** `convex/assignments.ts:72,75,123,126` (`if (!item) return`); `convex/payments.ts:13-24` (no check that participant belongs to `billId`); `validateBillForFinalize` throws `Error` while auth throws `ConvexError`.

**Why it matters:** Silent returns make the client believe a mutation succeeded when nothing changed; a payment can be attached to a participant from another bill; inconsistent error types complicate client handling.

**Recommended fix:** Throw `ConvexError` consistently; verify participant-on-bill in `payments.add`; standardize error type.

---

## LIF-4 🟢 Money validators don't constrain range; missing/unused indexes

**Evidence:** All money fields are `v.number()` (no non-negative/integer constraint); `by_status` index unused (`schema.ts:26`); `payments` lacks `by_participantId` (forces filter in `participants.ts:70-77`).

**Recommended fix:** Add shared non-negative integer validators for money on mutations; drop `by_status` or use it; add `by_participantId` on payments.

---

### Area D — suggested tasks

1. **LIF-1:** Scheduled cleanup cron for sessions/buckets/scans.
2. **LIF-2:** Payment correction + audit note.
3. **LIF-3:** Throw-not-return; participant-on-bill check; unify errors.
4. **LIF-4:** Money range validators; index cleanup.

---

# Area E — Architecture & scalability (lower urgency)

| ID | Sev | Finding | Evidence | Recommendation |
|----|-----|---------|----------|----------------|
| ARC-1 | 🟡 | `listWithSummary` N+1 (per-bill relation loads) | `convex/bills.ts:62-179` | Batch/paginate or denormalize summary fields |
| ARC-2 | 🟢 | `participants.listRecentNames` N+1 | `convex/participants.ts:19-23` | Cap bills scanned or denormalize recent names |
| ARC-3 | 🟢 | `bills.ts` (346 lines) mixes summary math | `convex/bills.ts` | Move math to shared lib; keep file thin |
| ARC-4 | 🟢 | `src/routes/bills/$billId/index.tsx` (~537 lines) | file | Extract receipt upload/scan orchestration to hooks |
| ARC-5 | 🟢 | No `(itemId, participantId)` uniqueness | `schema.ts:45-53` | App-level dedupe on insert (or unique index if supported) |
| ARC-6 | 🟢 | No audit log / soft deletes / multi-currency | schema | Consider if product needs history or undo of bill delete |

---

# Cross-cutting: the anchor decision

Before implementing Area A, decide the **guest access model**:

- **Option 1 — Capability links (recommended for this product):** bills are shared by a secret token, not the raw ID. Add `shareToken` (SEC-4), require it everywhere guest-facing, keep finalized-bill locking (SEC-2), gate guest payment details (UX-1) and receipt viewing behind it. Revocable via rotation.
- **Option 2 — Real access control:** guests get lightweight identity (e.g. host-issued per-person link/PIN). Heavier, but enables true per-diner privacy.

`files.getUrl` (SEC-1) and dev-auth (SEC-3) should be fixed **regardless** of this decision.

---

# What's already done well (keep)

- Host write-path authorization (`requireBillOwner`, `assertCanMutateAssignment`, `requireGuestSession`).
- Integer cents end-to-end; deterministic remainder split conserves cents exactly.
- Normalized schema with practical denormalization (`billId` on assignments → single indexed load).
- Guest session model (TTL, single-device conflict, heartbeat).
- Finalize gate (blocks unassigned items and unit mismatch).
- Cascade delete on bill removal including storage + scans.
- Guest returns `myPayments` only (never full payments list).
- Solid unit-test foundation for the calculation module.
- Bulgarian-first locale, safe-area handling, PWA basics, rich share text, loading skeletons on host screens.

---

# Suggested build order

1. ~~**Anchor decision** (capability links vs access control).~~ ✅ Done (Area A)
2. ~~**Area A** — SEC-1, SEC-3 (unconditional), then SEC-4 → SEC-2, SEC-5, SEC-6.~~ ✅ Done
3. ~~**Area B** — MON-1/MON-2 consolidation + MON-6 reconciliation test, then MON-3/4/5.~~ ✅ Done → `docs/superpowers/plans/2026-07-09-area-b-money-correctness.md`
4. ~~**Area C** — UX-1 through UX-7.~~ ✅ Done → `docs/superpowers/plans/2026-07-09-area-c-guest-payment-ux.md`
4b. ~~**Area C polish** — UX-8, UX-9.~~ ✅ Done
5. ~~**Area D** — LIF-1..4.~~ ✅ Done → `docs/superpowers/plans/2026-07-09-area-d-lifecycle-correctness.md`
6. ~~**Area E** — ARC-1..5.~~ ✅ Done → `docs/superpowers/plans/2026-07-09-area-e-architecture-scalability.md` (ARC-6 deferred)
