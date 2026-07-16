# VAL-2 — Participants Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate participant names on add — inline errors on manual input, duplicate/cap/finalized guards client + server.

**Architecture:** `shared/participant-schema.ts` wraps `personNameSchema`; `validateParticipantAdd` used in `ParticipantList` and `participants.add`; cap logic extended in `friendGroups.addToBill`.

**Tech Stack:** Zod 4, Convex, React, Vitest

**Spec:** `docs/superpowers/specs/2026-07-09-val-2-participants-design.md`

**Status:** ✅ Complete (2026-07-09)

---

## Task 1: Participant schema (TDD)

**Files:**

- Create: `shared/participant-schema.ts`
- Create: `shared/participant-schema.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// shared/participant-schema.test.ts
import { describe, expect, it } from 'vitest'
import {
  participantNameKey,
  parseParticipantName,
  validateParticipantAdd,
} from './participant-schema'
import { BILL_PARTICIPANTS_MAX, PERSON_NAME_MAX } from './validation/constants'

describe('participantNameKey', () => {
  it('normalizes case and trim', () => {
    expect(participantNameKey('  Иван ')).toBe('иван')
  })
})

describe('parseParticipantName', () => {
  it('accepts valid names', () => {
    const result = parseParticipantName('  Мария ')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe('Мария')
  })

  it('rejects empty names', () => {
    expect(parseParticipantName('  ').success).toBe(false)
  })

  it('rejects overlong names', () => {
    expect(parseParticipantName('x'.repeat(PERSON_NAME_MAX + 1)).success).toBe(
      false,
    )
  })
})

describe('validateParticipantAdd', () => {
  const baseContext = {
    existingNames: ['Иван'],
    participantCount: 1,
  }

  it('rejects duplicates case-insensitively', () => {
    const result = validateParticipantAdd({ name: 'иван' }, baseContext)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Този участник вече е на сметката')
    }
  })

  it('rejects when cap reached', () => {
    const result = validateParticipantAdd(
      { name: 'Петър' },
      { existingNames: [], participantCount: BILL_PARTICIPANTS_MAX },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Максимум 50 участника на сметка')
    }
  })

  it('accepts a new valid name', () => {
    const result = validateParticipantAdd({ name: 'Георги' }, baseContext)
    expect(result).toEqual({ ok: true, name: 'Георги' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run shared/participant-schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schema**

```ts
// shared/participant-schema.ts
import { z } from 'zod'
import { BILL_PARTICIPANTS_MAX } from './validation/constants'
import { personNameSchema } from './validation/fields'

export type ParticipantAddInput = { name: string }

export type ParticipantAddContext = {
  existingNames: string[]
  participantCount: number
}

const DUPLICATE_MESSAGE = 'Този участник вече е на сметката'
const CAP_MESSAGE = `Максимум ${BILL_PARTICIPANTS_MAX} участника на сметка`

export function participantNameKey(name: string): string {
  return name.trim().toLowerCase()
}

export function parseParticipantName(name: string) {
  return personNameSchema.safeParse(name)
}

export function formatParticipantNameError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Невалидно име'
}

export function validateParticipantAdd(
  input: ParticipantAddInput,
  context: ParticipantAddContext,
): { ok: true; name: string } | { ok: false; message: string; field?: 'name' } {
  const parsed = parseParticipantName(input.name)
  if (!parsed.success) {
    return {
      ok: false,
      message: formatParticipantNameError(parsed.error),
      field: 'name',
    }
  }

  const trimmedName = parsed.data
  const key = participantNameKey(trimmedName)
  const existingKeys = new Set(
    context.existingNames.map((existing) => participantNameKey(existing)),
  )

  if (existingKeys.has(key)) {
    return { ok: false, message: DUPLICATE_MESSAGE, field: 'name' }
  }

  if (context.participantCount >= BILL_PARTICIPANTS_MAX) {
    return { ok: false, message: CAP_MESSAGE, field: 'name' }
  }

  return { ok: true, name: trimmedName }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run shared/participant-schema.test.ts`
Expected: PASS

---

## Task 2: Re-export shims

**Files:**

- Create: `src/lib/participant-schema.ts`
- Create: `convex/lib/participantSchema.ts`

- [ ] **Step 1: Client shim**

```ts
// src/lib/participant-schema.ts
export {
  formatParticipantNameError,
  parseParticipantName,
  participantNameKey,
  validateParticipantAdd,
} from '../../shared/participant-schema'
export type {
  ParticipantAddContext,
  ParticipantAddInput,
} from '../../shared/participant-schema'
```

- [ ] **Step 2: Convex shim**

```ts
// convex/lib/participantSchema.ts
export {
  parseParticipantName,
  participantNameKey,
  validateParticipantAdd,
} from '../../shared/participant-schema'
export type {
  ParticipantAddContext,
  ParticipantAddInput,
} from '../../shared/participant-schema'
```

---

## Task 3: Server — `participants.add`

**Files:**

- Modify: `convex/participants.ts`

- [ ] **Step 1: Add validation and finalized guard**

Replace `add` handler body:

```ts
import { validateParticipantAdd } from './lib/participantSchema'

export const add = mutation({
  args: { billId: v.id('bills'), name: v.string() },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    if (bill.status === 'final') {
      throw new ConvexError('Сметката е завършена.')
    }

    const existing = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    const validated = validateParticipantAdd(
      { name: args.name },
      {
        existingNames: existing.map((participant) => participant.name),
        participantCount: existing.length,
      },
    )
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const id = await ctx.db.insert('participants', {
      billId: args.billId,
      name: validated.name,
      sortOrder: existing.length,
    })
    await touchBill(ctx, args.billId)
    return id
  },
})
```

- [ ] **Step 2: Run Convex TypeScript**

Run: `npx convex codegen`
Expected: TypeScript passes

---

## Task 4: Server — `friendGroups.addToBill` cap

**Files:**

- Modify: `convex/friendGroups.ts`

- [ ] **Step 1: Add cap + defensive name parse in loop**

Add imports:

```ts
import { BILL_PARTICIPANTS_MAX } from '../../shared/validation/constants'
import {
  parseParticipantName,
  participantNameKey,
} from './lib/participantSchema'
```

Replace the `for (const name of selectedNames)` loop:

```ts
for (const name of selectedNames) {
  if (existing.length + added >= BILL_PARTICIPANTS_MAX) {
    skipped += 1
    continue
  }

  const parsed = parseParticipantName(name)
  if (!parsed.success) {
    skipped += 1
    continue
  }

  const trimmedName = parsed.data
  const key = participantNameKey(trimmedName)
  if (existingKeys.has(key)) {
    skipped += 1
    continue
  }

  await ctx.db.insert('participants', {
    billId: args.billId,
    name: trimmedName,
    sortOrder,
  })
  existingKeys.add(key)
  sortOrder += 1
  added += 1
}
```

Remove the old inline trim/duplicate block.

---

## Task 5: UI — `ParticipantList`

**Files:**

- Modify: `src/components/bills/participant-list.tsx`

- [ ] **Step 1: Add `nameError` state and validation in `handleAdd`**

```ts
import { validateParticipantAdd } from '#/lib/participant-schema.ts'

const [nameError, setNameError] = useState<string | undefined>()

async function handleAdd(participantName?: string) {
  const raw = participantName ?? name
  const validated = validateParticipantAdd(
    { name: raw },
    {
      existingNames: participants.map((participant) => participant.name),
      participantCount: participants.length,
    },
  )
  if (!validated.ok) {
    if (participantName === undefined) {
      setNameError(validated.message)
    } else {
      toast.error(validated.message)
    }
    return
  }

  setNameError(undefined)
  if (participantName === undefined) {
    setName('')
  }
  try {
    await addParticipant({ billId, name: validated.name })
    nameInputRef.current?.focus()
  } catch (error) {
    toast.error(getConvexErrorMessage(error))
  }
}
```

- [ ] **Step 2: Wire inline error on manual input**

On name `Input`:

```tsx
onChange={(e) => {
  setName(e.target.value)
  if (nameError) setNameError(undefined)
}}
aria-invalid={Boolean(nameError)}
```

Below input (inside manual add form):

```tsx
{
  nameError ? <p className="text-xs text-destructive">{nameError}</p> : null
}
```

Wrap input + error in `flex flex-col gap-1.5` inside the form if needed for layout.

- [ ] **Step 3: Keep submit disabled when empty**

```tsx
<Button type="submit" className="h-11" disabled={!name.trim()}>
```

Unchanged — validation still runs on submit for pasted whitespace-only edge cases.

---

## Task 6: Docs & verification

**Files:**

- Modify: `docs/superpowers/specs/2026-07-09-val-2-participants-design.md` — Status → Approved
- Modify: `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md` — VAL-2 → ✅ Done

- [ ] **Step 1: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass

- [ ] **Step 2: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

- [ ] **Step 3: Manual QA**

1. Add „Иван“ → success
2. Add „иван“ → inline duplicate error on manual input
3. Quick-add duplicate name → toast error
4. Group add with overlap → existing summary toast
5. (Optional) 51st participant → cap error

---

## Self-review (spec coverage)

| Spec requirement               | Task          |
| ------------------------------ | ------------- |
| `shared/participant-schema.ts` | Task 1        |
| Duplicate client + server      | Tasks 1, 3, 5 |
| Cap on add                     | Tasks 1, 3, 4 |
| Finalized guard                | Task 3        |
| Inline manual add errors       | Task 5        |
| Group bulk skip semantics      | Task 4        |

---

**Next after completion:** VAL-3 Items spec (`val-3-items-design.md`)
