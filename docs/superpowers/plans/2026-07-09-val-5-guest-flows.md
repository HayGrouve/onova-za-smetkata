# VAL-5 — Guest Flows Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize guest error messages; validate `deviceId` on `guestSessions.claim` via `deviceIdSchema`; remove silent truncation.

**Architecture:** `shared/guest-flow-messages.ts` for Bulgarian copy; `shared/guest-claim-schema.ts` for `parseGuestClaimInput` + `buildClaimActorKey`; Convex + client import via shims.

**Tech Stack:** Zod 4, Convex, React, Vitest

**Spec:** `docs/superpowers/specs/2026-07-09-val-5-guest-flows-design.md`

**Status:** ✅ Complete (2026-07-09)

---

## Task 1: Guest flow messages

**Files:**

- Create: `shared/guest-flow-messages.ts`
- Create: `shared/guest-flow-messages.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// shared/guest-flow-messages.test.ts
import { describe, expect, it } from 'vitest'
import { GUEST_FLOW_MESSAGES } from './guest-flow-messages'

describe('GUEST_FLOW_MESSAGES', () => {
  it('has non-empty values for all keys', () => {
    for (const value of Object.values(GUEST_FLOW_MESSAGES)) {
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('preserves prior server literals (regression)', () => {
    expect(GUEST_FLOW_MESSAGES.participantNotOnBill).toBe(
      'Участникът не принадлежи на тази сметка.',
    )
    expect(GUEST_FLOW_MESSAGES.nameTaken).toBe(
      'Това име вече е заето от друг телефон.',
    )
    expect(GUEST_FLOW_MESSAGES.sessionExpired).toBe(
      'Сесията изтече. Изберете името си отново.',
    )
    expect(GUEST_FLOW_MESSAGES.claimRateLimitActor).toBe(
      'Твърде много опити за присъединяване. Опитайте отново след малко.',
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run shared/guest-flow-messages.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement messages**

```ts
// shared/guest-flow-messages.ts
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run shared/guest-flow-messages.test.ts`
Expected: PASS

---

## Task 2: Guest claim schema (TDD)

**Files:**

- Create: `shared/guest-claim-schema.ts`
- Create: `shared/guest-claim-schema.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// shared/guest-claim-schema.test.ts
import { describe, expect, it } from 'vitest'
import { buildClaimActorKey, parseGuestClaimInput } from './guest-claim-schema'
import { DEVICE_ID_MAX } from './validation/constants'

describe('parseGuestClaimInput', () => {
  it('returns undefined deviceId when omitted or blank', () => {
    expect(parseGuestClaimInput({})).toEqual({ ok: true, deviceId: undefined })
    expect(parseGuestClaimInput({ deviceId: '  ' })).toEqual({
      ok: true,
      deviceId: undefined,
    })
  })

  it('trims valid deviceId', () => {
    expect(parseGuestClaimInput({ deviceId: '  abc  ' })).toEqual({
      ok: true,
      deviceId: 'abc',
    })
  })

  it('accepts max-length deviceId', () => {
    const id = 'x'.repeat(DEVICE_ID_MAX)
    expect(parseGuestClaimInput({ deviceId: id })).toEqual({
      ok: true,
      deviceId: id,
    })
  })

  it('rejects overlong deviceId instead of truncating', () => {
    const result = parseGuestClaimInput({
      deviceId: 'x'.repeat(DEVICE_ID_MAX + 1),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('64')
    }
  })
})

describe('buildClaimActorKey', () => {
  it('uses device prefix when deviceId present', () => {
    expect(buildClaimActorKey('token-uuid', 'dev-1')).toBe('device:dev-1')
  })

  it('falls back to token prefix when deviceId absent', () => {
    expect(
      buildClaimActorKey('0123456789abcdef0123456789abcdef', undefined),
    ).toBe('token:0123456789abcdef0123456789abcdef')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run shared/guest-claim-schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schema**

```ts
// shared/guest-claim-schema.ts
import { deviceIdSchema } from './validation/fields'

export type GuestClaimInput = {
  deviceId?: string
}

export function parseGuestClaimInput(
  input: GuestClaimInput,
): { ok: true; deviceId?: string } | { ok: false; message: string } {
  const parsed = deviceIdSchema.safeParse(input.deviceId)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Невалиден идентификатор',
    }
  }
  return { ok: true, deviceId: parsed.data }
}

export function buildClaimActorKey(
  sessionToken: string,
  deviceId?: string,
): string {
  if (deviceId) return `device:${deviceId}`
  return `token:${sessionToken.slice(0, 36)}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run shared/guest-claim-schema.test.ts`
Expected: PASS

---

## Task 3: Re-export shims

**Files:**

- Create: `src/lib/guest-flow-messages.ts`
- Create: `src/lib/guest-claim-schema.ts`
- Create: `convex/lib/guestFlowMessages.ts`
- Create: `convex/lib/guestClaimSchema.ts`

- [ ] **Step 1: Client shims**

```ts
// src/lib/guest-flow-messages.ts
export { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages'
export type { GuestFlowMessageKey } from '../../shared/guest-flow-messages'

// src/lib/guest-claim-schema.ts
export {
  buildClaimActorKey,
  parseGuestClaimInput,
} from '../../shared/guest-claim-schema'
export type { GuestClaimInput } from '../../shared/guest-claim-schema'
```

- [ ] **Step 2: Convex shims**

```ts
// convex/lib/guestFlowMessages.ts
export { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages'

// convex/lib/guestClaimSchema.ts
export {
  buildClaimActorKey,
  parseGuestClaimInput,
} from '../../shared/guest-claim-schema'
```

---

## Task 4: Server — message refactor + claim validation

**Files:**

- Modify: `convex/lib/guestAccess.ts`
- Modify: `convex/lib/requireGuestSession.ts`
- Modify: `convex/lib/assertCanMutateAssignment.ts`
- Modify: `convex/lib/assertAssignmentEditable.ts`
- Modify: `convex/guestSessions.ts`

- [ ] **Step 1: `guestAccess.ts`**

```ts
import { GUEST_FLOW_MESSAGES } from './guestFlowMessages'

// bill not found:
throw new ConvexError(GUEST_FLOW_MESSAGES.billNotFound)
// invalid share token:
throw new ConvexError(GUEST_FLOW_MESSAGES.invalidShareLink)
```

- [ ] **Step 2: `requireGuestSession.ts`**

```ts
import { GUEST_FLOW_MESSAGES } from './guestFlowMessages'

// participant mismatch:
throw new ConvexError(GUEST_FLOW_MESSAGES.participantNotOnBill)
// session missing / expired:
throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
```

- [ ] **Step 3: `assertCanMutateAssignment.ts`**

```ts
import { GUEST_FLOW_MESSAGES } from './guestFlowMessages'

throw new ConvexError(GUEST_FLOW_MESSAGES.sessionRequired)
```

- [ ] **Step 4: `assertAssignmentEditable.ts`**

```ts
import { GUEST_FLOW_MESSAGES } from './guestFlowMessages'

const errorMessages: Record<AssignmentEditableError, string> = {
  bill_final: GUEST_FLOW_MESSAGES.billFinalNoEdit,
  participant_not_on_bill: GUEST_FLOW_MESSAGES.participantNotOnBill,
}
```

- [ ] **Step 5: `guestSessions.ts`**

Add imports:

```ts
import { GUEST_FLOW_MESSAGES } from './lib/guestFlowMessages'
import {
  buildClaimActorKey,
  parseGuestClaimInput,
} from './lib/guestClaimSchema'
```

Remove local `claimActorKey` function; use `buildClaimActorKey`.

In `assertParticipantOnBill`:

```ts
throw new ConvexError(GUEST_FLOW_MESSAGES.participantNotOnBill)
```

In `assertClaimRateLimits`:

```ts
const actor = buildClaimActorKey(sessionToken, deviceId)
await assertRateLimit(
  ctx,
  `claim:actor:${actor}:bill:${billId}`,
  10,
  60_000,
  GUEST_FLOW_MESSAGES.claimRateLimitActor,
)
await assertRateLimit(
  ctx,
  `claim:bill:${billId}`,
  100,
  60_000,
  GUEST_FLOW_MESSAGES.claimRateLimitBill,
)
```

In `claim` handler — **before** rate limits:

```ts
const parsedDevice = parseGuestClaimInput({ deviceId: args.deviceId })
if (!parsedDevice.ok) {
  throw new ConvexError(parsedDevice.message)
}

await assertClaimRateLimits(
  ctx,
  args.billId,
  args.sessionToken,
  parsedDevice.deviceId,
)
```

Replace name-taken error:

```ts
throw new ConvexError(GUEST_FLOW_MESSAGES.nameTaken)
```

- [ ] **Step 6: Run Convex TypeScript**

Run: `npx convex codegen`
Expected: TypeScript passes

---

## Task 5: Client — join + claim static copy

**Files:**

- Modify: `src/routes/bills/$billId/join.tsx`
- Modify: `src/routes/bills/$billId/claim.tsx`

- [ ] **Step 1: `join.tsx`**

```ts
import { GUEST_FLOW_MESSAGES } from '#/lib/guest-flow-messages.ts'
```

Replace invalid-link paragraph text with `{GUEST_FLOW_MESSAGES.invalidJoinLink}`.

- [ ] **Step 2: `claim.tsx`**

```ts
import { GUEST_FLOW_MESSAGES } from '#/lib/guest-flow-messages.ts'
```

In `handleSessionLost`:

```ts
toast.error(GUEST_FLOW_MESSAGES.sessionLostRedirect)
```

---

## Task 6: Docs & verification

**Files:**

- Modify: `docs/superpowers/specs/2026-07-09-val-5-guest-flows-design.md` — Status → Approved
- Modify: `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md` — VAL-5 → ✅ Done

- [ ] **Step 1: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass

- [ ] **Step 2: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

- [ ] **Step 3: Manual QA**

1. Join with valid link → pick name → claim OK
2. Same name from second session → `nameTaken` toast
3. Session lost on claim → redirect toast uses shared message
4. Guest assignment toggle on draft bill → OK
5. Guest assignment on final bill → `billFinalNoEdit`
6. Rapid claim attempts → rate-limit message unchanged

- [ ] **Step 4: Update plan status**

Mark this plan **Status:** ✅ Complete

---

## Self-review (spec coverage)

| Spec requirement                               | Task      |
| ---------------------------------------------- | --------- |
| `guest-flow-messages.ts` + tests               | Task 1    |
| Regression literals preserved                  | Task 1    |
| `parseGuestClaimInput` + tests                 | Task 2    |
| `buildClaimActorKey` (no `.slice` on deviceId) | Task 2, 4 |
| Re-export shims                                | Task 3    |
| `guestSessions.claim` validates deviceId       | Task 4    |
| Message constants in Convex guest paths        | Task 4    |
| Rate-limit keys/limits unchanged               | Task 4    |
| Client join/claim static copy                  | Task 5    |

---

**Next after completion:** VAL-6 Receipt import spec (`val-6-receipt-import-design.md`)
