# Step Completion Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color the bill editor step bar from live data — current = primary, other steps = success if done / muted if incomplete — without blocking navigation.

**Architecture:** Pure `getBillStepCompletion` in `shared/` (step 4 delegates to `validateBillForFinalize`). `BillStepsBar` takes a `completed` map and applies the color matrix + a11y labels. Editor route memos completion from bill data and the controlled `restaurantName` field.

**Tech Stack:** TypeScript, Vitest, React, existing Tailwind success/primary/border tokens

**Spec:** `docs/superpowers/specs/2026-07-16-step-completion-indicators-design.md`

## Global Constraints

- Done rules: (1) restaurant trimmed non-empty (2) ≥1 participant (3) ≥1 item and every item has ≥1 assignment (4) `validateBillForFinalize` empty
- Step 3 does not require restaurant/participants; unit mismatches do not block step 3
- Colors: current → `bg-primary`; other done → `bg-success`; other incomplete → `bg-border`
- Navigation unchanged — any step remains tappable
- No persisted completion flags; no check icons
- Bulgarian a11y: `завършена` / `незавършена` in segment `aria-label`
- Prefer displayed restaurant name (controlled editor field) for step 1

---

## File map

| File                                      | Responsibility                                          |
| ----------------------------------------- | ------------------------------------------------------- |
| `shared/bill-step-completion.ts`          | Pure `getBillStepCompletion`                            |
| `shared/bill-step-completion.test.ts`     | Vitest for all four steps                               |
| `src/lib/bill-step-completion.ts`         | Re-export shim (same pattern as `bill-calculations.ts`) |
| `src/components/bills/bill-steps-bar.tsx` | Accept `completed`; color matrix + aria-labels          |
| `src/routes/bills/$billId/index.tsx`      | `useMemo` completion; pass into `BillStepsBar`          |
| Spec status                               | Mark Complete when done                                 |

---

### Task 1: `getBillStepCompletion` (TDD)

**Files:**

- Create: `shared/bill-step-completion.ts`
- Create: `shared/bill-step-completion.test.ts`
- Create: `src/lib/bill-step-completion.ts` (re-export)

**Interfaces:**

- Consumes: `validateBillForFinalize`, `ParticipantInput`, `ItemInput`, `AssignmentInput` from `shared/bill-calculations.ts`
- Produces:

```ts
export type BillStepNumber = 1 | 2 | 3 | 4

export type BillStepCompletion = Record<BillStepNumber, boolean>

export interface BillStepCompletionInput {
  restaurantName: string
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
}

export function getBillStepCompletion(
  input: BillStepCompletionInput,
): BillStepCompletion
```

- [ ] **Step 1: Write failing tests**

```ts
// shared/bill-step-completion.test.ts
import { describe, expect, it } from 'vitest'
import { getBillStepCompletion } from './bill-step-completion'

const p1 = { id: 'p1', sortOrder: 0 }
const i1 = { id: 'i1', unitPriceCents: 1000, quantity: 1 }
const a1 = { itemId: 'i1', participantId: 'p1' }

describe('getBillStepCompletion', () => {
  it('marks step 1 done only when restaurant name is non-empty after trim', () => {
    expect(
      getBillStepCompletion({
        restaurantName: '   ',
        participants: [],
        items: [],
        assignments: [],
      })[1],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: '  Механа  ',
        participants: [],
        items: [],
        assignments: [],
      })[1],
    ).toBe(true)
  })

  it('marks step 2 done when there is at least one participant', () => {
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [],
        items: [],
        assignments: [],
      })[2],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [],
        assignments: [],
      })[2],
    ).toBe(true)
  })

  it('marks step 3 done when every item has an assignment and there is ≥1 item', () => {
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [],
        assignments: [],
      })[3],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [i1],
        assignments: [],
      })[3],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [i1],
        assignments: [a1],
      })[3],
    ).toBe(true)
  })

  it('marks step 3 done for zero-price items when assigned', () => {
    const free = { id: 'i2', unitPriceCents: 0, quantity: 1 }
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [free],
        assignments: [{ itemId: 'i2', participantId: 'p1' }],
      })[3],
    ).toBe(true)
  })

  it('does not require restaurant for step 3 done', () => {
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [],
        items: [i1],
        assignments: [a1],
      })[3],
    ).toBe(true)
  })

  it('marks step 4 done only when finalize validation passes', () => {
    // step 3 done but missing restaurant → step 4 incomplete
    expect(
      getBillStepCompletion({
        restaurantName: '',
        participants: [p1],
        items: [i1],
        assignments: [a1],
      })[4],
    ).toBe(false)
    expect(
      getBillStepCompletion({
        restaurantName: 'Механа',
        participants: [p1],
        items: [i1],
        assignments: [a1],
      })[4],
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm exec vitest run shared/bill-step-completion.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement helper**

```ts
// shared/bill-step-completion.ts
import {
  validateBillForFinalize,
  type AssignmentInput,
  type ItemInput,
  type ParticipantInput,
} from './bill-calculations.ts'

export type BillStepNumber = 1 | 2 | 3 | 4

export type BillStepCompletion = Record<BillStepNumber, boolean>

export interface BillStepCompletionInput {
  restaurantName: string
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
}

export function getBillStepCompletion(
  input: BillStepCompletionInput,
): BillStepCompletion {
  const step1 = input.restaurantName.trim().length > 0
  const step2 = input.participants.length >= 1
  const step3 =
    input.items.length >= 1 &&
    input.items.every((item) =>
      input.assignments.some((a) => a.itemId === item.id),
    )
  const step4 = validateBillForFinalize(input).length === 0
  return { 1: step1, 2: step2, 3: step3, 4: step4 }
}
```

```ts
// src/lib/bill-step-completion.ts
export * from '../../shared/bill-step-completion.ts'
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm exec vitest run shared/bill-step-completion.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/bill-step-completion.ts shared/bill-step-completion.test.ts src/lib/bill-step-completion.ts
git commit -m "$(cat <<'EOF'
feat: add getBillStepCompletion helper for editor step bar

EOF
)"
```

---

### Task 2: `BillStepsBar` colors + a11y

**Files:**

- Modify: `src/components/bills/bill-steps-bar.tsx`

**Interfaces:**

- Consumes: `BillStepCompletion` type from `#/lib/bill-step-completion.ts` (or inline `Record<BillStep, boolean>`)
- Produces: updated `BillStepsBarProps` with required `completed: BillStepCompletion`

- [ ] **Step 1: Update props and segment classes**

Replace the `s <= step ? 'bg-primary' : 'bg-border'` logic with the matrix. Update `aria-label`.

```tsx
import type { BillStepCompletion } from '#/lib/bill-step-completion.ts'

export interface BillStepsBarProps {
  step: BillStep
  completed: BillStepCompletion
  onStepSelect: (step: BillStep) => void
}

// inside map:
const done = completed[s]
const isCurrent = s === step
const segmentClass = isCurrent
  ? 'bg-primary'
  : done
    ? 'bg-success'
    : 'bg-border'
const completionLabel = done ? 'завършена' : 'незавършена'

// button:
aria-label={`Стъпка ${s}: ${label}, ${completionLabel}`}
aria-current={isCurrent ? 'step' : undefined}
className={cn(
  'h-1.5 flex-1 cursor-pointer rounded-full transition-colors',
  segmentClass,
)}
```

Keep caption `Стъпка {step} · {BILL_STEP_LABELS[step - 1]}` unchanged.

- [ ] **Step 2: Typecheck call sites**

```bash
pnpm exec tsc --noEmit -p . 2>&1 | rg "bill-steps-bar|BillStepsBar" || true
```

Expected: error that `completed` is missing at the editor call site (fixed in Task 3). No other breakages (only one consumer).

- [ ] **Step 3: Commit**

```bash
git add src/components/bills/bill-steps-bar.tsx
git commit -m "$(cat <<'EOF'
feat: color BillStepsBar from completion map

EOF
)"
```

---

### Task 3: Wire editor route

**Files:**

- Modify: `src/routes/bills/$billId/index.tsx`

**Interfaces:**

- Consumes: `getBillStepCompletion` from `#/lib/bill-step-completion.ts`
- Passes `completed` into `<BillStepsBar />`

- [ ] **Step 1: Memoize completion and pass prop**

Near other memos (after participants/items/assignments are in scope):

```tsx
import { getBillStepCompletion } from '#/lib/bill-step-completion.ts'

const stepCompletion = useMemo(
  () =>
    getBillStepCompletion({
      restaurantName,
      participants: participants.map((p) => ({
        id: p._id,
        sortOrder: p.sortOrder,
      })),
      items: items.map((i) => ({
        id: i._id,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
      })),
      assignments: assignments.map((a) => ({
        itemId: a.itemId,
        participantId: a.participantId,
        units: a.units,
      })),
    }),
  [restaurantName, participants, items, assignments],
)
```

Change:

```tsx
<BillStepsBar step={step} onStepSelect={goToStep} />
```

to:

```tsx
<BillStepsBar step={step} completed={stepCompletion} onStepSelect={goToStep} />
```

Use the controlled `restaurantName` state (not only `bill.restaurantName`) so step 1 tracks what the host sees before debounce save.

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit -p . 2>&1 | rg "bill-steps-bar|bill-step-completion|index\.tsx" || true
```

Expected: no errors in these files.

- [ ] **Step 3: Manual smoke**

1. Open a draft bill on step 1 — segment 1 primary; others muted unless already done.
2. Type restaurant name → leave to step 2 → segment 1 `bg-success`.
3. With host auto-participant, step 2 often already success.
4. Add item + assign all → step 3 success when not current.
5. Complete finalize requirements → step 4 success when not current.
6. Tap any step — navigation still works; current always primary.

- [ ] **Step 4: Commit**

```bash
git add src/routes/bills/$billId/index.tsx
git commit -m "$(cat <<'EOF'
feat: wire step completion into bill editor steps bar

EOF
)"
```

---

### Task 4: Spec status + regression tests

**Files:**

- Modify: `docs/superpowers/specs/2026-07-16-step-completion-indicators-design.md` (Status → Complete)

- [ ] **Step 1: Re-run unit tests**

```bash
pnpm exec vitest run shared/bill-step-completion.test.ts
```

Expected: PASS.

- [ ] **Step 2: Walk success criteria**

- [ ] Done steps show success when not current
- [ ] Current step always primary
- [ ] Navigation never blocked
- [ ] Step 4 done matches finalize validator

- [ ] **Step 3: Mark spec Complete**

Set `**Status:** Complete`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-16-step-completion-indicators-design.md
git commit -m "$(cat <<'EOF'
docs: mark step completion indicators spec complete

EOF
)"
```

---

## Spec coverage check

| Spec requirement                      | Task               |
| ------------------------------------- | ------------------ |
| `getBillStepCompletion` + unit tests  | Task 1             |
| Color matrix + a11y labels            | Task 2             |
| Editor wiring + local restaurant name | Task 3             |
| Free navigation unchanged             | Task 3 (no guards) |
| Spec Complete + QA                    | Task 4             |

## Placeholder / consistency check

- Type name `BillStepNumber` in shared avoids importing UI `BillStep`; values are the same `1\|2\|3\|4`.
- Step 4 always calls `validateBillForFinalize` — no duplicated finalize rules.
- `completed` is required on `BillStepsBar` (no silent default that reintroduces old `s <= step` fill).
