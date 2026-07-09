# VAL-0 — Validation Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared Zod field primitives, strict EUR parsing, and error helpers in `shared/validation/` — no new user-facing validation yet.

**Architecture:** `shared/validation/*` re-exported via `src/lib/validation/` and `convex/lib/validation.ts`; domain schemas (VAL-1+) compose field fragments.

**Tech Stack:** Zod 4, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-07-09-val-0-validation-framework-design.md`

**Status:** ✅ Complete (2026-07-09)

---

## Task 1: Constants

**Files:** Create `shared/validation/constants.ts`

- [x] Export all caps from spec (`PERSON_NAME_MAX`, `RESTAURANT_NAME_MAX`, etc.)

## Task 2: EUR strict parser (TDD)

**Files:** `shared/validation/eur.ts`, `shared/validation/eur.test.ts`

- [x] Test: `12,50` → 1250, empty/abc/negative/overflow → error
- [x] Implement `parseEurInputStrict`, `eurInputSchema(label?)`

## Task 3: Error helpers (TDD)

**Files:** `shared/validation/errors.ts`, `shared/validation/errors.test.ts`

- [x] Test: `formatZodFieldErrors` first issue per field; `firstZodIssueMessage`
- [x] Implement both helpers

## Task 4: Field schemas (TDD)

**Files:** `shared/validation/fields.ts`, `shared/validation/fields.test.ts`

- [x] Test: personName, restaurantName required/optional, optionalNote, quantity, cents, billDate, deviceId, groupName
- [x] Implement all field schemas

## Task 5: Re-exports

**Files:** `src/lib/validation/index.ts`, `convex/lib/validation.ts`

- [x] Re-export constants, fields, eur, errors

## Task 6: Friend-group refactor (optional, zero behavior change)

**Files:** `shared/friend-group-schema.ts`

- [x] Use `personNameSchema`, `groupNameSchema`, constants from validation
- [x] Existing `friend-group-schema.test.ts` must still pass

## Task 7: Docs & verify

**Files:** `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md`

- [x] Mark VAL-0 ✅
- [x] `pnpm run preflight`
