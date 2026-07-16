# VAL-5 — Guest Flows Validation (Scoped Design)

**Date:** 2026-07-09  
**Status:** Approved  
**Parent:** `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md`  
**Depends on:** VAL-0 (`deviceIdSchema`, `DEVICE_ID_MAX`)  
**Scope:** Centralized guest error messages + `deviceId` validation on claim — light touch, no new guest input fields

---

## Goal

Harden guest join/claim paths with shared VAL-0 `deviceIdSchema`, consolidate Bulgarian error copy for guest mutations in one module, and keep existing session/rate-limit semantics unchanged. Guest UX stays **selection-based** (pick participant name) — no new free-text identity fields.

---

## Non-goals

- Email, phone, or display-name text inputs for guests
- `sessionToken` format validation (client-generated UUID; existing DB uniqueness suffices)
- Guest assignment unit/rate-limit rule changes
- Replacing `getConvexErrorMessage` globally (only align guest-specific client copy where it duplicates server messages)
- Receipt import (VAL-6)

---

## Surfaces

| Surface               | Input type            | Mutation / path                                        | VAL-5 change                               |
| --------------------- | --------------------- | ------------------------------------------------------ | ------------------------------------------ |
| Join — pick name      | Participant selection | `guestSessions.claim`                                  | Validate `deviceId`; shared error messages |
| Join — resume session | Stored session        | `guestSessions.claim`                                  | Same                                       |
| Claim — assignments   | Tap / units           | `assignments.toggle`, `assignments.setUnits`           | Shared error messages only                 |
| Claim — heartbeat     | —                     | `guestSessions.heartbeat`                              | Shared error messages only                 |
| Claim — release       | —                     | `guestSessions.release`                                | Unchanged                                  |
| Guest bill load       | Share token in URL    | `bills.getForGuest`, `guestSessions.listActiveForBill` | Shared error messages only                 |

---

## Current gaps

| Gap                       | Today                                                                                                                                     | VAL-5 fix                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `deviceId` on claim       | `deviceId?.trim().slice(0, 64)` — **silent truncate**                                                                                     | `deviceIdSchema` — reject over 64; empty → `undefined` (token-based rate-limit key) |
| Error strings             | Duplicated literals across `guestSessions`, `guestAccess`, `requireGuestSession`, `assertCanMutateAssignment`, `assertAssignmentEditable` | `shared/guest-flow-messages.ts` constants                                           |
| Client session-lost toast | Hardcoded combined message in `claim.tsx`                                                                                                 | Use shared constant(s); keep combined UX copy                                       |

---

## Validation rules

### `deviceId` (claim only)

Uses existing `deviceIdSchema` from `shared/validation/fields.ts`:

| Input                 | Result                                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| `undefined` / omitted | `undefined` — rate-limit actor falls back to `token:{sessionToken}`    |
| `""` / whitespace     | `undefined` after trim                                                 |
| Valid ≤ 64 chars      | Trimmed string stored in rate-limit key `device:{id}`                  |
| > 64 chars            | Invalid — `ConvexError` with `Идентификаторът може да е до 64 символа` |

Replaces silent `.slice(0, 64)` in `claimActorKey`.

### Participant / session (unchanged logic)

- `assertParticipantOnBill` — participant exists on bill (selection UI prevents invalid picks; server guard stays)
- Session exclusivity — one active session per participant name (unchanged)
- Rate limits — actor 10/min, bill 100/min (unchanged keys and thresholds)

---

## Shared modules

### Error messages — `shared/guest-flow-messages.ts`

Single source of truth for guest-related Bulgarian copy. No runtime i18n layer — constants only.

```ts
export const GUEST_FLOW_MESSAGES = {
  billNotFound: 'Сметката не е намерена.',
  invalidShareLink: 'Невалиден или изтекъл линк за споделяне.',
  participantNotOnBill: 'Участникът не принадлежи на тази сметка.',
  claimRateLimitActor:
    'Твърде много опити за присъединяване. Опитайте отново след малко.',
  claimRateLimitBill:
    'Твърде много опити за присъединяване към тази сметка. Опитайте отново след малко.',
  nameTaken: 'Това име вече е заето от друг телефон.',
  sessionExpired: 'Сесията изтече. Изберете името си отново.',
  sessionRequired: 'Изисква се валидна гост-сесия.',
  billFinalNoEdit: 'Сметката е приключена и не може да се редактира.',
  sessionLostRedirect: 'Сесията изтече или името е заето. Изберете отново.',
  invalidJoinLink:
    'Невалиден линк за присъединяване. Попитайте домакина за нов линк.',
} as const

export type GuestFlowMessageKey = keyof typeof GUEST_FLOW_MESSAGES
```

**Tests:** `shared/guest-flow-messages.test.ts` — snapshot or key coverage (all values non-empty Bulgarian strings).

### Claim input — `shared/guest-claim-schema.ts`

```ts
export type GuestClaimInput = {
  deviceId?: string
}

export function parseGuestClaimInput(
  input: GuestClaimInput,
): { ok: true; deviceId?: string } | { ok: false; message: string }
```

Wraps `deviceIdSchema.safeParse`. Output `deviceId` is `undefined` when absent/blank.

**Shims:** `src/lib/guest-claim-schema.ts`, `convex/lib/guestClaimSchema.ts` (re-export `parseGuestClaimInput` only — messages imported directly in Convex from shared path).

---

## Server behavior

### `guestSessions.claim`

```ts
const parsed = parseGuestClaimInput({ deviceId: args.deviceId })
if (!parsed.ok) {
  throw new ConvexError(parsed.message)
}

await assertClaimRateLimits(
  ctx,
  args.billId,
  args.sessionToken,
  parsed.deviceId,
)
```

`claimActorKey(sessionToken, deviceId?)` — use normalized `deviceId` from schema (no `.slice`).

Replace hardcoded `ConvexError` strings with `GUEST_FLOW_MESSAGES.*`.

### Other guest paths (message refactor only)

| File                                      | Messages to import                               |
| ----------------------------------------- | ------------------------------------------------ |
| `convex/lib/guestAccess.ts`               | `billNotFound`, `invalidShareLink`               |
| `convex/lib/requireGuestSession.ts`       | `participantNotOnBill`, `sessionExpired`         |
| `convex/lib/assertCanMutateAssignment.ts` | `sessionRequired`                                |
| `convex/lib/assertAssignmentEditable.ts`  | `billFinalNoEdit`, `participantNotOnBill`        |
| `convex/guestSessions.ts`                 | `participantNotOnBill`, rate limits, `nameTaken` |

`assertRateLimit` default message stays generic for non-guest keys; claim passes explicit `GUEST_FLOW_MESSAGES` (unchanged text).

### Rate-limit regression guard

Do **not** change:

- `claim:actor:{actor}:bill:{billId}` key shape (actor prefix `device:` vs `token:` unchanged)
- Limits: 10 / 60s per actor, 100 / 60s per bill
- Message strings (only moved to constants — same user-visible text)

Add test: `parseGuestClaimInput` + `claimActorKey` helper test that 65-char deviceId fails schema (not truncated).

---

## Client behavior

### `join.tsx`

Replace hardcoded invalid-link string with `GUEST_FLOW_MESSAGES.invalidJoinLink` (import from `src/lib/guest-flow-messages.ts` shim).

Toast on claim failure — unchanged (`getConvexErrorMessage` passes server `ConvexError` message through).

### `claim.tsx`

Replace `handleSessionLost` toast with `GUEST_FLOW_MESSAGES.sessionLostRedirect`.

### `getConvexErrorMessage`

Unchanged implementation — server messages already flow through `error.message`. Fallback `Неуспешна операция` stays local (not guest-specific).

---

## Files

| File                                      | Action                                                         |
| ----------------------------------------- | -------------------------------------------------------------- |
| `shared/guest-flow-messages.ts`           | Create — message constants                                     |
| `shared/guest-flow-messages.test.ts`      | Create                                                         |
| `shared/guest-claim-schema.ts`            | Create — `parseGuestClaimInput`                                |
| `shared/guest-claim-schema.test.ts`       | Create                                                         |
| `src/lib/guest-flow-messages.ts`          | Create — re-export                                             |
| `src/lib/guest-claim-schema.ts`           | Create — re-export                                             |
| `convex/lib/guestClaimSchema.ts`          | Create — re-export                                             |
| `convex/guestSessions.ts`                 | `parseGuestClaimInput`; message constants; fix `claimActorKey` |
| `convex/lib/guestAccess.ts`               | Message constants                                              |
| `convex/lib/requireGuestSession.ts`       | Message constants                                              |
| `convex/lib/assertCanMutateAssignment.ts` | Message constants                                              |
| `convex/lib/assertAssignmentEditable.ts`  | Message constants                                              |
| `src/routes/bills/$billId/join.tsx`       | Shared invalid-link message                                    |
| `src/routes/bills/$billId/claim.tsx`      | Shared session-lost message                                    |

---

## Testing

### Schema tests (`shared/guest-claim-schema.test.ts`)

- `undefined` / `""` → `{ ok: true, deviceId: undefined }`
- `"  abc  "` → trimmed `"abc"`
- 64-char string passes
- 65-char string fails with deviceId max message

### Message map test

- All `GUEST_FLOW_MESSAGES` values are non-empty strings
- Key messages match prior literals (regression table in test comments)

### Manual QA

1. Join with valid share link → pick name → claim succeeds
2. Second device picks same name → `nameTaken` toast
3. Claim page after TTL / conflict → session-lost redirect toast
4. Guest toggles assignment on draft bill → works
5. Guest assignment on final bill → `billFinalNoEdit` error
6. Rapid claim retries → rate-limit message (unchanged wording)
7. (Dev) Send 65-char `deviceId` to claim → rejected, not truncated

---

## Exit criteria

- [x] `shared/guest-flow-messages.ts` documented and used by guest Convex paths
- [x] `parseGuestClaimInput` + tests; `guestSessions.claim` uses schema
- [x] No silent `deviceId` truncation
- [x] Claim rate-limit keys/limits/messages unchanged (constants only)
- [x] Client join/claim use shared messages for static copy
- [x] `pnpm run preflight` passes
- [x] Roadmap VAL-5 marked ✅

---

## Next phase

**VAL-6 — Receipt import** (`docs/superpowers/specs/2026-07-09-val-6-receipt-import-design.md`): validate OCR review rows before `receiptScan.apply` using VAL-3 item rules.
