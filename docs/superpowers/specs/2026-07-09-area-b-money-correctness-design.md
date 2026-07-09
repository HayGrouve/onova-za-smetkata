# Area B — Money Correctness (Scoped Design)

**Date:** 2026-07-09  
**Status:** ✅ Implemented (2026-07-09)  
**Parent audit:** `docs/superpowers/specs/2026-07-08-application-audit.md`  
**Findings covered:** MON-1 through MON-6  
**Prerequisite:** Area A complete (SEC-1–SEC-7)

---

## Summary

This spec scopes **Wave 2** from the application audit: **Area B — Money correctness**. Area A closed security/privacy gaps; Wave 2 makes money math **correct by construction** instead of correct by luck.

The core problem: split and validation logic lives in **three places** (`src/lib/bill-calculations.ts`, inline in `convex/bills.ts` `listWithSummary`, and `convex/lib/validateBillForFinalize.ts`). They can drift silently — especially the home dashboard “outstanding” figure vs summary/claim pages.

**Recommended delivery:** three phases — consolidate shared math first, add reconciliation tests, then fix split-semantics edge cases and write-path normalization.

---

## Goals

1. **Single source of truth** for bill totals, participant balances, and finalize validation.
2. **Guaranteed reconciliation:** `sum(participant owed) === bill total` (items + tip) for every valid bill state.
3. **Client/server parity:** dashboard, summary, claim, and finalize gate all use the same functions.
4. **Close latent bugs** in split semantics (`qty=1`, mixed units/cents, quantity edits) before they reach users.

## Non-goals (Area B)

- Guest/payment UX (Area C — Wave 3): IBAN display, equal-split shortcut UI, touch targets.
- Payment undo/correction UI (Area D `LIF-2` / UX-6) — only add server-side payment validation hooks here.
- `assignAll` UI exposure (deferred to Wave 3 UX-4; fix backend semantics now so it's safe when wired).
- Architecture refactors (`ARC-1` N+1 `listWithSummary`) — opportunistic only if touched.
- Multi-currency, tax lines, discounts, or service charges beyond current tip model.

---

## Anchor decision 1: shared money module

**Chosen approach:** Extract pure TypeScript into `shared/bill-calculations.ts` at repo root.

| Principle | Decision |
|-----------|----------|
| Where does math live? | `shared/bill-calculations.ts` — no Convex or React imports |
| Client imports | `src/lib/bill-calculations.ts` becomes a thin re-export (preserve existing `#/lib/bill-calculations.ts` paths) |
| Convex imports | `convex/lib/bill-calculations.ts` re-exports from `../../shared/bill-calculations.ts` |
| Tests | Primary suite at `shared/bill-calculations.test.ts`; existing `src/lib/bill-calculations.test.ts` can re-export or be migrated |
| `splitUnits` | Merge `convex/lib/splitUnits.ts` duplicate into shared module; delete Convex copy |

**Why not Convex-only?** Client needs totals for summary, claim footer, sticky bar, and finalize preview — all must match server without a round-trip.

**Why not `src/lib` only?** Convex can import parent-dir pure TS; a dedicated `shared/` folder signals “no framework deps” and avoids `src/` ↔ `convex/` coupling confusion.

---

## Anchor decision 2: per-item split mode

**Chosen model:** Each item is in exactly one mode — **cent-split** or **unit-split** — never mixed on the same item.

| Mode | When | Storage | Example |
|------|------|---------|---------|
| **Cent-split** | `quantity === 1` OR no `units` on any assignment for that item | Assignments **without** `units` field | €12 pizza shared by 3 → €4 + €4 + €4 |
| **Unit-split** | `quantity > 1` AND at least one assignment has `units` | All assignments for item **must** have `units` | 4 beers, 2 units to Alice |

**Rules:**

1. **`quantity === 1`:** Always cent-split. Never write `units` on assignments. `splitUnits(1, N)` is **not** used for money allocation on qty=1 items.
2. **`quantity > 1`:** Once any assignment gets `units`, all assignments for that item use `units`; `sum(units) === quantity`.
3. **Mixed assignments on one item (MON-3):** Invalid state. Normalization on write prevents it; existing bad data fixed by a one-time backfill or lazy fix on read (see Phase B3).
4. **`assignAll` (MON-4):** Not exposed in UI today. Fix backend: qty=1 → cent-split all participants; qty>1 → unit-split via `splitUnits`. Safe for future UX-4 shortcut.

**Why not always units?** qty=1 with `splitUnits(1, 3) → [1,0,0]` assigns 100% to first participant — wrong for “split evenly.” Cent-split is already what the UI toggle path does for single-qty items.

---

## Threat / impact model

| Risk | Before | After |
|------|--------|-------|
| Dashboard outstanding ≠ summary | 🔴 Separate inline algorithm in `listWithSummary` | ✅ Same `calculateBillTotals` |
| Client says “can finalize”, server rejects | 🔴 Duplicated `validateBillForFinalize` | ✅ One function, shared tests |
| Mixed units/cents on one item | 🟡 Lost cents | ✅ Normalized on write; migration for existing |
| Reduce item quantity | 🟡 `assignedUnits > quantity` | ✅ Clamp/rebalance on update |
| `assignAll` wired to UI | 🔴 qty=1 gives 100% to one person | ✅ Correct semantics before exposure |
| Cent regression undetected | 🟡 Per-case tests only | ✅ Global reconciliation + edge-case matrix |

---

## MON-1 🔴 — Split logic triplicated; dashboard can diverge

### Problem

`convex/bills.ts` `listWithSummary` (lines ~105–172) re-implements owed/paid/outstanding math inline. It mirrors `calculateBillTotals` but is a separate copy.

### Design

**Replace** inline block with:

```ts
import { calculateBillTotals } from './lib/bill-calculations'

const totals = calculateBillTotals({
  participants: participants.map((p) => ({ id: p._id, sortOrder: p.sortOrder })),
  items: items.map((i) => ({ id: i._id, unitPriceCents: i.unitPriceCents, quantity: i.quantity })),
  assignments: assignments.map((a) => ({
    itemId: a.itemId,
    participantId: a.participantId,
    units: a.units,
  })),
  payments: payments.map((p) => ({
    participantId: p.participantId,
    amountCents: p.amountCents,
  })),
  tipCents: bill.tipCents ?? 0,
})

const totalOutstandingCents = Object.values(totals.byParticipant).reduce(
  (sum, p) => sum + Math.max(0, p.balanceCents),
  0,
)
```

### Files

| File | Change |
|------|--------|
| `shared/bill-calculations.ts` | New — move logic from `src/lib/bill-calculations.ts` |
| `src/lib/bill-calculations.ts` | Re-export from `shared/` |
| `convex/lib/bill-calculations.ts` | Re-export from `../../shared/bill-calculations.ts` |
| `convex/bills.ts` | Delete ~70 lines inline math; call shared function |
| `convex/lib/splitUnits.ts` | Delete — use shared `splitUnits` |

### Acceptance criteria

- [ ] `listWithSummary` outstanding matches summary page for the same bill data.
- [ ] No duplicate owed/tip/paid loops remain in `convex/bills.ts`.

---

## MON-2 🔴 — `validateBillForFinalize` duplicated

### Problem

Identical logic in `src/lib/bill-calculations.ts:281-346` and `convex/lib/validateBillForFinalize.ts`.

### Design

- Move `validateBillForFinalize` and `ValidationError` types into `shared/bill-calculations.ts`.
- `convex/lib/validateBillForFinalize.ts` becomes thin wrapper:

```ts
import { validateBillForFinalize } from './bill-calculations'
export { validateBillForFinalize }
export function assertBillCanFinalize(input) {
  const errors = validateBillForFinalize(input)
  if (errors.length > 0) throw new ConvexError(errors[0].message) // see LIF-3
}
```

- Client keeps importing from `#/lib/bill-calculations.ts` (re-export).

### Acceptance criteria

- [ ] One implementation of validation rules.
- [ ] `assertBillCanFinalize` throws `ConvexError` (not bare `Error`) — pairs with LIF-3.

---

## MON-6 🟢 — Global reconciliation test; payment validation hooks

### Problem

Tests check individual scenarios but not the invariant `sum(owed) === billTotal`. `payments.add` accepts any positive amount with no participant-on-bill check or cap.

### Design

**Tests** — add to `shared/bill-calculations.test.ts`:

1. **Reconciliation property:** For fixture bills, assert:
   - `sum(byParticipant[].owedCents) === billTotalCents`
   - `billTotalCents === sum(items) + tipCents`
2. **Edge-case matrix** (explicit cases):
   - €10.00 ÷ 3 participants (remainder 1¢)
   - €10.01 ÷ 3 participants
   - Single item qty=1, 4 assignees (cent-split)
   - qty=4 item, unit assignments summing to 4
   - Tip €1 ÷ 3
3. **Consumer parity test:** Given same input object, `listWithSummary` outstanding (via extracted helper or integration test) equals `calculateBillTotals` sum of balances.

**Payment validation** (minimal, no undo UI):

```ts
// convex/payments.ts — add checks in add handler
- assert participant.billId === args.billId
- assert args.amountCents > 0
- optional: warn cap at participant owed (soft — allow overpay but document; or hard reject)
```

**Decision:** **Soft cap with warning** is out of scope; **hard reject overpayment** is simpler for MVP:

```ts
const owed = totals.byParticipant[participantId]?.owedCents ?? 0
const paid = /* sum existing payments for participant */
if (paid + args.amountCents > owed) {
  throw new ConvexError('Сумата надвишава дължимото.')
}
```

Defer payment removal (LIF-2) to Wave 3/4.

### Acceptance criteria

- [ ] Reconciliation test fails if someone reintroduces duplicate math.
- [ ] Edge-case matrix covers remainder splits.
- [ ] `payments.add` rejects non-positive amounts and cross-bill participant mismatch.

---

## MON-3 🟡 — Dual split semantics (units vs cents) can lose cents

### Problem

`usesUnits = some(assignment.units !== undefined)` — if one assignee has `units` and another doesn't, cent-split assignees are ignored.

### Design

**Write-path normalization** in `assignments.toggle`, `assignments.setUnits`, and `syncEvenAssignments`:

| Item state | Action |
|------------|--------|
| `quantity === 1` | Insert/delete assignments **without** `units`; use cent-split in calculator |
| `quantity > 1`, first assignment | If toggling on: use `units: 1` for first assignee; subsequent toggles use units |
| `quantity > 1`, existing cent-split (no units) | On next mutation, migrate item to unit mode: distribute `splitUnits(quantity, n)` across current assignees |

**Backfill** (optional internal mutation `backfill:normalizeAssignmentModes`):

- For each item with mixed assignments, convert to consistent mode per anchor decision.
- Run once after deploy; idempotent.

### Acceptance criteria

- [ ] No item can have both `units` and non-`units` assignments after any mutation.
- [ ] Calculator test: mixed-mode fixture either normalizes or is rejected with clear error.

---

## MON-4 🟡 — `assignAll` gives whole qty=1 item to one person

### Problem

`syncEvenAssignments` always uses `splitUnits` + writes `units`. For qty=1, N=3 → `[1,0,0]`.

### Design

Update `syncEvenAssignments`:

```ts
if (item.quantity === 1) {
  // Cent-split: delete existing, insert one row per participant WITHOUT units
  for (const participantId of sortedIds) {
    await ctx.db.insert('itemAssignments', { billId, itemId, participantId })
  }
  return
}
// qty > 1: existing unit path with splitUnits
```

**Do not** add UI for `assignAll` in Area B — only make the mutation correct for future UX-4.

### Acceptance criteria

- [ ] `assignAll` on qty=1 item with 3 participants creates 3 assignments without `units`.
- [ ] `calculateBillTotals` gives each participant equal cents share.

---

## MON-5 🟡 — Item quantity edits don't rebalance assignments

### Problem

`convex/items.ts` `update` patches quantity without touching assignments.

### Design

On `quantity` decrease in `items.update`:

1. Load assignments for item.
2. If **unit mode** (`some(a.units !== undefined)`):
   - If `sum(units) > newQuantity`: clamp from highest `sortOrder` assignees downward, or proportional trim — **recommended: clamp excess from last assignees** until `sum === quantity`.
   - If `sum(units) < newQuantity`: leave gap (host must assign remainder) — same as today.
3. If **cent mode** (no units): no assignment change needed (cent-split recalculates from count).
4. If `newQuantity === 0` or item deleted: existing cascade delete handles it.

If rebalance is complex, **Phase B3 alternative:** block quantity decrease with `ConvexError` when `sum(units) > newQuantity` and ask host to unassign first. Simpler; slightly worse UX.

**Recommendation:** **Block with clear error** for MVP (less risk than silent clamp). Document in spec:

```ts
if (assignedUnits > newQuantity) {
  throw new ConvexError(
    'Намалете разпределенията преди да намалите количеството.',
  )
}
```

### Acceptance criteria

- [ ] Reducing quantity below assigned units cannot leave DB in invalid state.
- [ ] Either auto-clamp or block — pick one; **default: block**.

---

## Phase plan

### Phase B1 — Consolidation (MON-1 + MON-2)

| Task | Finding | Size |
|------|---------|------|
| Create `shared/bill-calculations.ts` | MON-1, MON-2 | M |
| Wire client + Convex re-exports | MON-1, MON-2 | S |
| Replace `listWithSummary` inline math | MON-1 | S |
| Delete duplicate `validateBillForFinalize` body | MON-2 | S |
| `assertBillCanFinalize` → `ConvexError` | LIF-3 overlap | S |

### Phase B2 — Test harness (MON-6)

| Task | Finding | Size |
|------|---------|------|
| Reconciliation + edge-case tests | MON-6 | M |
| `payments.add` validation | MON-6, LIF-3 | S |
| Parity test: dashboard vs calculator | MON-1, MON-6 | S |

### Phase B3 — Split semantics (MON-3 + MON-4 + MON-5)

| Task | Finding | Size |
|------|---------|------|
| Normalize write paths in `assignments.ts` | MON-3, MON-4 | M |
| Fix `syncEvenAssignments` qty=1 branch | MON-4 | S |
| Quantity decrease guard in `items.update` | MON-5 | S |
| Optional `backfill:normalizeAssignmentModes` | MON-3 | S |

---

## Files touched (summary)

| Area | Files |
|------|-------|
| **New** | `shared/bill-calculations.ts`, `shared/bill-calculations.test.ts`, `convex/lib/bill-calculations.ts` |
| **Modify** | `src/lib/bill-calculations.ts`, `convex/bills.ts`, `convex/lib/validateBillForFinalize.ts`, `convex/assignments.ts`, `convex/items.ts`, `convex/payments.ts` |
| **Delete** | `convex/lib/splitUnits.ts` (merged into shared) |
| **Tests** | Migrate/extend `src/lib/bill-calculations.test.ts` |
| **Docs** | Update audit remediation table when complete |

---

## Verification

```bash
pnpm run test          # shared + existing suites
pnpm run preflight     # full gate before merge
```

**Manual smoke:**

1. Create bill with 3 participants, 1× €12 item — assign all via chips → each owes €4.00.
2. Dashboard “outstanding” on home matches summary page total unpaid.
3. Finalize preview errors match server rejection (unassigned item).
4. Reduce qty=4 item to qty=2 with 4 units assigned → blocked with Bulgarian error (if block strategy).
5. Record payment equal to owed → succeeds; overpayment → rejected.

---

## Relationship to future waves

| Wave | Area | Depends on Area B |
|------|------|-------------------|
| **Wave 3** | Area C UX (UX-1–UX-7) | UX-4 equal-split shortcut needs MON-4 `assignAll` fix |
| **Wave 3/4** | UX-6 / LIF-2 payment undo | MON-6 payment validation is prerequisite for safe undo |
| **Wave 4** | Area D lifecycle | LIF-3 error consistency partially done in B1/B2 |

---

## Audit cross-reference

When Area B ships, update `docs/superpowers/specs/2026-07-08-application-audit.md`:

| ID | Target status |
|----|---------------|
| MON-1 | ✅ Done |
| MON-2 | ✅ Done |
| MON-3 | ✅ Done |
| MON-4 | ✅ Done (backend only; no UI) |
| MON-5 | ✅ Done |
| MON-6 | ✅ Done |

---

## Open questions (defaults chosen — change before implementation if needed)

| Question | Default in this spec |
|----------|----------------------|
| Overpayment on `payments.add` | Hard reject |
| Quantity decrease with excess units | Block with error (no silent clamp) |
| Mixed-mode existing data | Optional backfill mutation |
| `assignAll` UI | Not in Area B |

---

## Spec self-review

- [x] No TBD sections — defaults documented in Open questions.
- [x] Anchor decisions explicit (shared module path, split mode rules).
- [x] Scope bounded to MON-1–MON-6; UX and payment undo deferred.
- [x] Phases ordered: consolidate → test → semantics (matches audit build order).
- [x] Consistent with Area A non-goals (no guest UX changes).
