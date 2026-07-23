# Per-unit item claiming — Design Spec

**Date:** 2026-07-20  
**Status:** Complete (locked for implementation handoff)  
**Scope:** Replace exclusive whole-unit claiming for quantity > 1 with per-unit membership so identical items can be split differently  
**Map:** [Per-unit item claiming spec](https://github.com/HayGrouve/onova-za-smetkata/issues/34)  
**Prototype:** branch `prototype/spodeli-modal` @ `765516f` — `/prototype/spodeli-modal?variant=A`  
**Builds on:** guest claim flow, claim share drawer, step-completion indicators, finalize read-only  
**Domain:** `CONTEXT.md` — **Unit**, **Unit index**, **Participant**, **Guest**, **Share**

---

## Problem

Today, quantity > 1 lines use exclusive whole-unit claiming (`units` count per participant). Two bottles of water cannot be shared differently (e.g. one split, one solo). The product needs independently claimable **units** with any-size participant sets per unit.

## Solution

Quantity > 1 is a stack of independently claimable **units**. Membership is stored per `(item, participant, unitIndex)`. Claiming for qty > 1 happens in a **Сподели** centered dialog of stacked unit cards; qty = 1 keeps today’s toggle. Empty units are allowed in draft and forbidden at finalize.

---

## Product locks (do not re-litigate)

| Topic               | Choice                                                                       |
| ------------------- | ---------------------------------------------------------------------------- |
| Quantity > 1        | Stack of independently claimable units; no cap on participants per unit      |
| Same participant    | May join multiple units on one line                                          |
| Split within a unit | Even split only (same remainder spirit as today’s qty = 1 share)             |
| Claim UX            | Host + guests; qty > 1 via **Сподели → modal**; qty = 1 keeps today’s toggle |
| Empty units         | Forbidden at finalize; allowed temporarily in draft                          |
| Quantity ↑          | Adds empty trailing units                                                    |
| Quantity ↓          | Drops trailing units + their memberships                                     |
| Exclusive claiming  | Replaced for qty > 1                                                         |
| Migration           | None — wipe existing claim data; new shape only from day one                 |

**Out of scope for this feature:** weighted/custom fractions within a unit; participant cap per unit; redesign of qty = 1 claiming; host “assign shares for others” beyond existing claim-mode patterns; end-to-end implementation (this document is the handoff).

---

## Data shape

Replaces exclusive `units` on `itemAssignments`.

**Target row:** `{ billId, itemId, participantId, unitIndex }`

| Rule         | Detail                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------- |
| Identity     | One membership row per `(itemId, participantId, unitIndex)` — join inserts, leave deletes |
| `unitIndex`  | Zero-based, `0 … quantity−1`                                                              |
| Quantity = 1 | Same shape with `unitIndex: 0` (UI may keep simple toggle)                                |
| Uniqueness   | At most one row per triple                                                                |
| Even-split   | Over participants that share the same `(itemId, unitIndex)`                               |
| Multi-unit   | A participant may hold multiple rows for the same item (different indexes)                |

**Ship prerequisite:** reset Convex / clear `itemAssignments` (and related claim data). No backfill, no dual-read/write.

**Ticket:** [How is unit membership stored?](https://github.com/HayGrouve/onova-za-smetkata/issues/35), [How do draft bills migrate off exclusive units?](https://github.com/HayGrouve/onova-za-smetkata/issues/38)

---

## Claim UI

### Parent row (quantity > 1), outside Сподели

| Element        | Behavior                                                                             |
| -------------- | ------------------------------------------------------------------------------------ |
| Identity       | Name, unit price × quantity, line total (unchanged)                                  |
| My involvement | If joined ≥1 unit → selected styling + count; if 0 → omit count, no selected styling |
| Line glance    | Unit coverage only (units with ≥1 participant). No other names on the parent         |
| Money          | No aggregate „Вашият дял“ on the parent                                              |
| Action         | Whole row opens Сподели; visible CTA; no inline join/stepper                         |

**Read-only (final / viewing):** same parent summary; modal still opens for inspection; join/leave disabled inside.

**Ticket:** [What does the parent item row show outside Сподели?](https://github.com/HayGrouve/onova-za-smetkata/issues/36)

### Сподели modal (quantity > 1)

Centered **dialog**; vertical stack of unit rows, each like today’s quantity = 1 claim card:

- Title: item name + 1-based unit label; unit price on the row
- Tap toggles current participant join/leave on that unit
- Selected styling + „✓ Ваше“ when joined
- Other participants visible; empty-unit hint when none
- Per-unit share preview on each unit row
- Join / leave hint on the card

Rejected alternatives: bottom-drawer checklist; one-unit-at-a-time stepper.

**Ticket:** [Сподели modal lists units as separate item rows](https://github.com/HayGrouve/onova-za-smetkata/issues/37)

---

## Finalize and step completion

**Coverage predicate:** for every item (including zero-price), every unit index `0 … quantity−1` has ≥1 participant.

| Surface             | Rule                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------- |
| Finalize            | Must pass the predicate                                                                 |
| Step 3              | Done only when ≥1 item and predicate holds for every item                               |
| Host unassigned cue | Count of items that fail the predicate                                                  |
| Error               | Replace `units_mismatch` with `empty_units` (count items that still have an empty unit) |

Unchanged: step 4 / all-paid / restaurant / participants. Writers keep `unitIndex` in range on quantity change.

**Ticket:** [How do finalize and step-completion treat per-unit claims?](https://github.com/HayGrouve/onova-za-smetkata/issues/39)

---

## Bulgarian copy

### Parent row (quantity > 1)

| Slot                           | Copy                      |
| ------------------------------ | ------------------------- |
| My involvement (only if N ≥ 1) | `Ваши бройки: {N} от {Q}` |
| Coverage (only if covered ≥ 1) | `{covered} от {Q} заети`  |
| CTA                            | `Сподели`                 |

No extra invite line when N = 0.

### Сподели modal (stacked unit cards)

| Slot            | Copy                                                                         |
| --------------- | ---------------------------------------------------------------------------- |
| Dialog title    | `Сподели · {name}`                                                           |
| Unit title      | `{name} · бройка {n}` (1-based)                                              |
| Joined          | `✓ Ваше`                                                                     |
| Others on unit  | `Споделено с {names} ({1 човек` / `N души`})` — same count helper as qty = 1 |
| Empty unit      | `Празна бройка`                                                              |
| Share preview   | `Вашият дял: {amount}`                                                       |
| Not joined hint | `Присъедини се`                                                              |
| Joined hint     | `Докоснете, за да излезете`                                                  |

### Breakdown / share-text / finalize

| Surface                                  | Copy                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Claim/summary breakdown suffix (qty > 1) | ` · {N} от {Q}` (N = units joined by that participant)                                  |
| Share-text per person on qty > 1 line    | `{name} {n} бр. ({amount})` — n = units joined; amount = their total Share on that item |
| Fully uncovered item in share-text       | `неразпределено`                                                                        |
| Finalize / validation (`empty_units`)    | `Има 1 неразпределен артикул.` / `Има {N} неразпределени артикула.`                     |
| Host chip                                | `{N} неразпределени`                                                                    |

**Ticket:** [What Bulgarian copy describes multi-unit involvement?](https://github.com/HayGrouve/onova-za-smetkata/issues/41)

---

## Concurrent claims and quantity edits

Locked defaults (former map fog):

| Topic                                        | Choice                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Concurrent join/leave on the same unit       | Insert/delete membership row; last successful mutation wins; no special locking beyond existing Convex mutation semantics |
| Host item-edit quantity after claims started | Standing rules: qty ↑ adds empty trailing units; qty ↓ drops trailing units + memberships                                 |
| Receipt / item-list replace                  | Keep today’s wipe-assignments behavior when the item list is replaced                                                     |

---

## Implementation notes (non-normative)

Suggested touch points (not a task breakdown):

- Schema / `itemAssignments` writers and readers (`convex/assignments.ts`, share math in `shared/bill-calculations.ts`)
- Claim parent row + Сподели dialog (`guest-item-row` / claim route)
- Finalize validation + step 3 (`validateBillForFinalize`, `getBillStepCompletion`, host unassigned count)
- Breakdown / share-text formatters (`bill-share.ts`)
- Wipe claim data before shipping the new shape

Use the prototype on `prototype/spodeli-modal` as visual reference for Variant A only; rewrite properly for production (no prototype switcher).

---

## Acceptance (handoff)

Implementation is done when:

1. Qty > 1 claiming uses per-unit membership and the Сподели stacked-card dialog.
2. Qty = 1 claiming behavior is unchanged in product terms.
3. Finalize, step 3, and host unassigned use full unit coverage.
4. Copy matches the tables above.
5. No exclusive `units` field remains in the live assignment shape; data was wiped, not migrated.
