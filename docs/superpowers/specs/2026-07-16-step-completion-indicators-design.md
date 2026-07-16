# Step Completion Indicators — Design Spec

**Date:** 2026-07-16  
**Status:** Complete  
**Scope:** Visual “done” state on the bill editor step progress bar when each step has the required data; free navigation unchanged  
**Approach:** 1 — Pure completion helper + thin `BillStepsBar` props  
**Builds on:** Existing `BillStepsBar`, `validateBillForFinalize`, editor route `?step=`

---

## Problem

The top step bar only shows how far the host has _navigated_ (`segment ≤ current step`). It does not show whether each step’s required data is filled, so progress through the bill is harder to scan at a glance.

## Solution

Derive per-step completion from live bill data and color the existing four segment bars:

- **Current** step → primary (even if that step is also complete)
- **Other** steps → success if done, muted if incomplete

Hosts can still jump to any step. No persisted flags; no check icons.

## UX decisions

| Topic                 | Choice                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| Done criteria         | Minimal basics (option A)                                                 |
| Visual language       | Color only (option C) — no checkmarks                                     |
| vs old “reached” fill | Hybrid (option C): current always primary; others done vs incomplete only |
| Updates               | Live from bill query / editor state                                       |
| Navigation            | Unchanged — any step tappable                                             |
| Persistence           | None — derived from data                                                  |

---

## Done rules

| Step | Label         | Done when                                                                                                                            |
| ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Бележка       | `restaurantName.trim()` non-empty                                                                                                    |
| 2    | Участници     | `participants.length ≥ 1`                                                                                                            |
| 3    | Разпределение | ≥1 item **and** every item has at least one assignment                                                                               |
| 4    | Преглед       | Finalize validation passes **and** every participant has payment status `paid` (host counts as paid when `hostParticipantId` is set) |

### Step 3 vs step 4

- Step 3 does **not** require restaurant name or participants.
- Step 3 treats “assigned” as presence of ≥1 assignment row per item (same idea as the unassigned-items finalize check). Unit-count mismatches for qty > 1 are **not** required for step 3 done; they still block step 4 via finalize validation.
- Step 4 requires finalize-ready (restaurant, ≥1 participant, ≥1 priced item, no unassigned items, units match when unit assignments are used) **and** all participants `paid` via `calculateBillTotals` (including host paid-by-rule).

### Edge cases

| Case                                    | Behavior                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Empty new bill                          | All incomplete except possibly none; current step primary                                                             |
| Host auto-participant present           | Step 2 done immediately when that participant exists                                                                  |
| Zero-price items                        | Step 3: still need an assignment if the item exists; step 4 still requires ≥1 priced item per finalize                |
| Finalized bill (forced step 4)          | Same colors; typically all done if finalize was allowed                                                               |
| Local draft restaurant name before save | Prefer the same value the editor shows (controlled field / bill doc after sync) so the bar matches what the host sees |

---

## Bar color matrix

| Condition                    | Class        |
| ---------------------------- | ------------ |
| `s === currentStep`          | `bg-primary` |
| `s !== currentStep` && done  | `bg-success` |
| `s !== currentStep` && !done | `bg-border`  |

Caption under the bar stays: `Стъпка {n} · {label}`.

### Accessibility

- Keep `aria-current="step"` on the current segment.
- Extend each segment `aria-label` to include completion, e.g. `Стъпка 2: Участници, завършена` / `…, незавършена`.
- Color is not the only signal (label text in accessible name).

---

## Architecture

### New

- `getBillStepCompletion(input) → Record<BillStep, boolean>` (or tuple) in shared/lib next to bill validation.
  - Input: restaurant name, participants, items, assignments (same shapes finalize uses where possible).
  - Step 4 delegates to `validateBillForFinalize(input).length === 0`.
  - Unit tests for each step’s true/false cases.

### Modified

- `BillStepsBar`: accept `completed: Record<BillStep, boolean>` (or `readonly boolean[]` length 4); apply color matrix; richer `aria-label`.
- Bill editor route (`src/routes/bills/$billId/index.tsx`): `useMemo` completion from bill data (+ local restaurant field if that is the displayed source of truth); pass into `BillStepsBar`.

### Unchanged

- `goToStep` / search `step` / `StepNavBar`
- Finalize mutation and error list on step 4
- Guest join/claim routes (no host step bar)

```
bill data → getBillStepCompletion → BillStepsBar(completed, step)
```

---

## Out of scope

- Preventing navigation to incomplete steps
- Check icons / extra glyphs on the bar
- Changing `validateBillForFinalize` rules
- Persisting completion flags on the bill
- Guest-facing step UI

---

## Testing

### Unit

- Step 1: empty vs trimmed name
- Step 2: zero vs one participant
- Step 3: no items; item without assignment; all assigned
- Step 4: mirrors finalize (missing restaurant still fails step 4 even if step 3 done)

### Manual

- Fill restaurant → step 1 turns success when leaving it (or while on 2–4)
- Add participant → step 2 success
- Add item + assign → step 3 success
- Satisfy finalize → step 4 success
- Jump freely between steps; current always primary

---

## Success criteria

1. Host can see at a glance which steps have required data.
2. Current step remains visually distinct (primary).
3. Navigation is never blocked by completion.
4. Step 4 done means finalize-ready **and** every participant is paid.
