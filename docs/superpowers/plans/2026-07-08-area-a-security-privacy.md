# Area A — Security & Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Area A security findings (SEC-1–SEC-7): receipt IDOR, dev-auth fail-closed, share-token guest access, final-bill impersonation fix, upload scoping, guest rate limits.

**Architecture:** Three phases — A1 hotfixes without URL changes; A2 `shareToken` capability model on all guest APIs + client `?t=` links; A3 upload/mutation hardening. See `docs/superpowers/specs/2026-07-08-area-a-security-privacy-design.md`.

**Tech Stack:** Convex, TanStack Router, Vitest, Playwright E2E

**Spec:** `docs/superpowers/specs/2026-07-08-area-a-security-privacy-design.md`

**Status:** ✅ Complete (2026-07-08)

---

## Phase A1 — Hotfixes

### Task 1: SEC-1 Receipt URL scoped to bill owner

**Files:**
- Modify: `convex/files.ts`
- Modify: `src/routes/bills/$billId/index.tsx`
- Modify: `src/components/bills/receipt-preview-card.tsx`

- [x] Replace `getUrl({ storageId })` with `getReceiptUrl({ billId })` using `requireBillOwner`
- [x] Update client callers
- [x] Run tests

### Task 2: SEC-3 Dev auth allowlist

**Files:**
- Modify: `convex/lib/devMode.ts`
- Create: `convex/lib/devMode.test.ts`
- Modify: `docs/DEPLOY.md`, `e2e/README.md`

- [x] Invert gate to dev allowlist + prod block
- [x] Add unit tests
- [x] Update docs

---

## Phase A2 — Share tokens + SEC-2

### Task 3: Schema + backfill

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/bills.ts` (create)
- Modify: `convex/backfill.ts`

- [x] Add `shareToken` to bills
- [x] Generate on create
- [x] `backfill:shareTokens` for existing bills

### Task 4: Guest access helper + API wiring

**Files:**
- Create: `convex/lib/guestAccess.ts`
- Create: `convex/lib/guestBill.ts` (sanitize response)
- Modify: `convex/bills.ts`, `convex/paymentSettings.ts`, `convex/guestSessions.ts`, `convex/assignments.ts`

- [x] `assertShareToken`
- [x] Wire all guest queries/mutations
- [x] Sanitize `getForGuest` bill payload
- [x] `rotateShareToken` mutation

### Task 5: Client join URLs + routes

**Files:**
- Modify: `src/lib/bill-join-url.ts`, `src/lib/bill-join-url.test.ts`
- Modify: `src/lib/guest-participant-session.ts`
- Modify: `src/routes/bills/$billId/join.tsx`, `claim.tsx`
- Modify: `src/components/bills/bill-invite-card.tsx`, `guest-claim-footer.tsx`
- Modify: `src/lib/site-meta.ts` (join OG URL with token if needed)

- [x] `?t=` in URLs; validate search on join route
- [x] Persist shareToken in guest session storage
- [x] Rotate link UI

### Task 6: SEC-2 Final bill impersonation

**Files:**
- Modify: `convex/guestSessions.ts` (claim handler)
- Modify: `src/routes/bills/$billId/join.tsx`

- [x] Same session conflict rules for final bills
- [x] Unified join UI with Заето

### Task 7: E2E + unit tests

**Files:**
- Modify: `e2e/*.spec.ts`, `e2e/helpers/host-auth.ts`
- Create: `convex/lib/guestAccess.test.ts` or client tests

- [x] E2E uses tokenized join URLs
- [x] Update audit doc checkboxes

---

## Phase A3 — Hardening

### Task 8: SEC-5 Upload scoping

**Files:**
- Modify: `convex/files.ts`, `src/routes/bills/$billId/index.tsx`

- [x] `generateUploadUrl({ billId })` + rate limit

### Task 9: SEC-6 Guest rate limits

**Files:**
- Modify: `convex/guestSessions.ts`, `convex/assignments.ts`, `convex/lib/requireGuestSession.ts`
- Modify: `src/lib/guest-participant-session.ts` (deviceId)
- Modify: `src/routes/bills/$billId/join.tsx`, `claim.tsx`

- [x] Per-actor claim limits + deviceId
- [x] Limits on heartbeat/toggle/setUnits

### Task 10: SEC-7 Documentation

**Files:**
- Modify: `docs/DEPLOY.md`
- Modify: `docs/superpowers/specs/2026-07-08-application-audit.md`

- [x] Document guest identity accepted risk
- [x] Mark SEC items resolved in audit
