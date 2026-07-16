# Application Validation — Phased Roadmap

**Date:** 2026-07-09  
**Status:** In progress (VAL-0–VAL-5 complete)  
**Goal:** Shared Zod validation everywhere user input enters the system — inline field errors in UI + hard reject in Convex (same pattern as payment settings)

---

## Decision summary

| Topic   | Choice                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------- |
| Goal    | **Both** — data integrity on server + inline form UX on client                                            |
| Pattern | Shared schema in `shared/` → re-export in `src/lib/` + `convex/lib/` shim → `safeParse` + `format*Errors` |
| Rollout | Phased specs + plans (this document); one phase per implementation cycle                                  |

---

## Reference pattern (payment settings)

Already implemented and is the template for all phases:

```
shared/<domain>-schema.ts     # Zod schema, parse*, format*Errors, normalize transforms
shared/<domain>-schema.test.ts
src/lib/<domain>-schema.ts    # Re-export for client
convex/lib/<domain>Schema.ts  # Re-export for Convex (no .ts in import path)
UI component                  # fieldErrors state, aria-invalid, destructive helper text
Convex mutation               # parse on handler; ConvexError(first issue message)
```

**Principles**

1. **Single source of truth** — rules live in `shared/`, not duplicated in UI and Convex.
2. **Normalize on success** — trim, case, cents conversion in `.transform()` or post-parse helpers.
3. **Fail fast in UI** — block submit / debounced save when invalid; show field-level messages in Bulgarian.
4. **Fail closed on server** — never trust client; mutations parse before write.
5. **Tests at schema level** — vitest on `shared/*-schema.test.ts`; no need to test every UI binding.

---

## Current state

| Surface                             | Client validation | Server validation            | Notes                                         |
| ----------------------------------- | ----------------- | ---------------------------- | --------------------------------------------- |
| Payment settings (Revolut, IBAN)    | ✅ Inline         | ✅ Zod                       | Pre-roadmap                                   |
| Friend groups                       | ✅ Inline         | ✅ Zod                       | Uses `personNameSchema` (VAL-0)               |
| Bill restaurant / note / tip / date | ✅ Inline         | ✅ Zod                       | **VAL-1** — `bill-metadata-schema`            |
| Participants                        | ✅ Inline         | ✅ Zod                       | **VAL-2** — duplicate, cap, finalized         |
| Items (add/edit)                    | ✅ Inline         | ✅ Zod                       | **VAL-3** — `item-schema`                     |
| Payments (partial)                  | ✅ Inline         | ✅ Zod                       | **VAL-4** — `payment-amount-schema`           |
| Guest join/claim                    | N/A (pick name)   | ✅ Zod + messages            | **VAL-5** — `deviceId`, `guest-flow-messages` |
| Receipt OCR import                  | ✅ Row errors     | ✅ Shared schema             | VAL-6 ✅                                      |
| Finalize                            | ✅ Summary errors | ✅ `validateBillForFinalize` | Unchanged                                     |
| Validation framework                | —                 | —                            | **VAL-0** — `shared/validation/`              |

---

## Phase overview

```text
Phase 0 ──► Framework & conventions (unblocks all others)
    │
    ├──► Phase 1 — Bill metadata (restaurant, note, tip, date)
    ├──► Phase 2 — Participants
    ├──► Phase 3 — Items
    ├──► Phase 4 — Payments
    ├──► Phase 5 — Guest flows (light)
    └──► Phase 6 — Receipt import review
```

Each phase produces:

1. `docs/superpowers/specs/2026-07-09-val-<n>-<name>-design.md`
2. `docs/superpowers/plans/2026-07-09-val-<n>-<name>.md`
3. Implementation + `pnpm run preflight`

Phases are **sequential** (0 first). Phases 1–4 can be parallelized after Phase 0 if multiple workers, but recommended order is 1 → 2 → 3 → 4 by host workflow frequency.

---

## Phase 0 — Validation framework ✅

**ID:** VAL-0  
**Spec:** `docs/superpowers/specs/2026-07-09-val-0-validation-framework-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-09-val-0-validation-framework.md`  
**Completed:** 2026-07-09

### Delivered

- `shared/validation/` — constants, fields, eur, errors + 30 tests
- `src/lib/validation/`, `convex/lib/validation.ts` re-exports
- Friend-group schema refactored to `personNameSchema`

### Exit criteria

- [x] Field primitives tested in isolation
- [x] Documented convention in VAL-0 spec
- [x] No user-facing behavior change

---

## Phase 1 — Bill metadata ✅

**ID:** VAL-1  
**Spec:** `docs/superpowers/specs/2026-07-09-val-1-bill-metadata-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-09-val-1-bill-metadata.md`  
**Depends on:** VAL-0  
**Completed:** 2026-07-09

### Delivered

- `shared/bill-metadata-schema.ts` — restaurant, note, tip, date
- Inline errors + `scheduleValidatedSave` in bill editor
- `bills.update` + `receiptScan.apply` server validation
- Strict tip parsing (no silent `0` on invalid input)

### Exit criteria

- [x] Shared `bill-metadata-schema.ts` + tests
- [x] Client inline errors on all four fields
- [x] `bills.update` rejects invalid payloads with `ConvexError`

---

## Phase 2 — Participants ✅

**ID:** VAL-2  
**Spec:** `docs/superpowers/specs/2026-07-09-val-2-participants-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-09-val-2-participants.md`  
**Depends on:** VAL-0  
**Completed:** 2026-07-09

### Delivered

- `shared/participant-schema.ts` — `validateParticipantAdd`, duplicate/cap guards
- `participants.add` — finalized + validation
- `friendGroups.addToBill` — cap enforcement
- Inline `nameError` on manual add in `ParticipantList`

### Exit criteria

- [x] `shared/participant-schema.ts` + tests
- [x] `participants.add` + `friendGroups.addToBill` validated
- [x] Inline error on manual add in `ParticipantList`

---

## Phase 3 — Items

**ID:** VAL-3  
**Spec:** `docs/superpowers/specs/2026-07-09-val-3-items-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-09-val-3-items.md`  
**Depends on:** VAL-0

### Surfaces

| Action    | UI                      | Mutation       |
| --------- | ----------------------- | -------------- |
| Add item  | Item list form          | `items.add`    |
| Edit item | Inline row fields       | `items.update` |
| Item note | Row expand (if present) | `items.update` |

### Proposed rules (draft)

| Field      | Rules                                                       |
| ---------- | ----------------------------------------------------------- |
| Name       | Trim; 1–120 chars                                           |
| Unit price | EUR input → non-negative int cents; reject NaN/empty on add |
| Quantity   | Int ≥ 1; max e.g. 999                                       |
| Note       | Optional; max 200 chars                                     |

### UX

- Per-field errors on add form and inline edit
- **Remove** silent `parseEurInput → 0` on invalid price for add flow
- Server uses same schema; keep assignment/qty-reduction business rules in mutation

### Exit criteria

- [x] `item-schema.ts` + tests including comma decimal input
- [x] Add form shows price/qty/name errors inline
- [x] `items.add` / `items.update` parse through schema

---

## Phase 4 — Payments

**ID:** VAL-4  
**Spec:** `docs/superpowers/specs/2026-07-09-val-4-payments-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-09-val-4-payments.md`  
**Depends on:** VAL-0, VAL-3 (EUR input helper)

### Surfaces

| Action          | UI                     | Mutation       |
| --------------- | ---------------------- | -------------- |
| Partial payment | `PaymentActions` input | `payments.add` |
| Mark full paid  | Button (no field)      | `payments.add` |

### Proposed rules (draft)

| Field  | Rules                                                     |
| ------ | --------------------------------------------------------- |
| Amount | Positive cents; ≤ remaining balance; EUR input validation |
| Note   | Optional; max 200 chars (if exposed later)                |

### UX

- Inline error under partial amount input
- Disable submit when amount invalid or > remaining
- Server keeps owed-cap check; schema validates format before business rules

### Exit criteria

- [x] `payment-amount-schema.ts` + tests
- [x] Inline error in `payment-actions.tsx`
- [x] `payments.add` validates amount through shared parser

---

## Phase 5 — Guest flows (light)

**ID:** VAL-5  
**Spec:** `docs/superpowers/specs/2026-07-09-val-5-guest-flows-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-09-val-5-guest-flows.md`  
**Depends on:** VAL-0, VAL-2

### Surfaces

Guest flows are mostly **selection**, not free text. Scope is narrow:

| Surface      | Validation need                                          |
| ------------ | -------------------------------------------------------- |
| Join / claim | Participant must exist on bill; session rules unchanged  |
| `deviceId`   | Max 64 chars (already trimmed server-side)               |
| Error copy   | Map `ConvexError` codes to consistent Bulgarian messages |

### Out of scope

- New guest identity fields
- Email/phone collection

### Exit criteria

- [x] Documented error message map for guest mutations
- [x] Any optional `deviceId` path uses shared string cap validator
- [x] No regression in claim rate limits

---

## Phase 6 — Receipt import review ✅

**ID:** VAL-6  
**Spec:** `docs/superpowers/specs/2026-07-09-val-6-receipt-import-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-09-val-6-receipt-import.md`  
**Depends on:** VAL-0, VAL-3

### Surfaces

| Action         | UI                          | Mutation                         |
| -------------- | --------------------------- | -------------------------------- |
| Apply OCR rows | `receipt-scan-review-sheet` | `receiptScan.importScannedItems` |

### Rules

| Check                 | Detail                                                       |
| --------------------- | ------------------------------------------------------------ |
| Each imported row     | Valid item name + non-negative price + qty ≥ 1               |
| Row-level errors      | Highlight invalid checked rows in review sheet before import |
| Restaurant suggestion | Optional `restaurantName` uses VAL-1 rules (client + server) |

### Exit criteria

- [x] Review sheet blocks apply when any selected row invalid
- [x] `importScannedItems` validates payload with shared item schema
- [x] Tests for typical OCR junk rows (empty name, zero price)

---

## Explicitly out of scope (all phases)

- Login / auth email validation (handled by Convex Auth + OAuth)
- Multi-currency (EUR only)
- Real-time validation on every keystroke for debounced bill fields (validate on blur or before save — decide per field in spec)
- Rewriting `validateBillForFinalize` (keep; align messages with field validators)

---

## Workflow per phase

```text
1. Brainstorm / review phase section in this roadmap
2. Write phase spec (scoped design) → user approves
3. Invoke writing-plans → implementation plan
4. Implement → preflight → deploy Convex if schema/mutations changed
5. Mark phase ✅ in this document
```

---

## Tracking table

| Phase          | ID    | Spec                                   | Plan                            | Status  |
| -------------- | ----- | -------------------------------------- | ------------------------------- | ------- |
| Framework      | VAL-0 | `val-0-validation-framework-design.md` | `val-0-validation-framework.md` | ✅ Done |
| Bill metadata  | VAL-1 | `val-1-bill-metadata-design.md`        | `val-1-bill-metadata.md`        | ✅ Done |
| Participants   | VAL-2 | `val-2-participants-design.md`         | `val-2-participants.md`         | ✅ Done |
| Items          | VAL-3 | `val-3-items-design.md`                | `val-3-items.md`                | ✅ Done |
| Payments       | VAL-4 | `val-4-payments-design.md`             | `val-4-payments.md`             | ✅ Done |
| Guest flows    | VAL-5 | `val-5-guest-flows-design.md`          | `val-5-guest-flows.md`          | ✅ Done |
| Receipt import | VAL-6 | `val-6-receipt-import-design.md`       | `val-6-receipt-import.md`       | ✅ Done |

**Already done (pre-roadmap):**

| Area             | Spec                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| Payment settings | `2026-07-09-payment-settings-validation-design.md` ✅                |
| Friend groups    | `2026-07-09-friend-groups-design.md` ✅ (partial overlap with VAL-2) |

---

## Suggested next step

**Validation program complete (VAL-0–VAL-6).** Deploy Convex changes: `npx convex deploy`.
