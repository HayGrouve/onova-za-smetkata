# E2E reshape — implementation scope

Scope for [Define the implementation-ready E2E cleanup scope](https://github.com/HayGrouve/onova-za-smetkata/issues/49), derived from [Choose the sustainable E2E portfolio](https://github.com/HayGrouve/onova-za-smetkata/issues/48) and the artifact audit in [Identify unique browser-level protection and E2E-only code](https://github.com/HayGrouve/onova-za-smetkata/issues/47).

## Summary

Reshape the Playwright suite from **13 tests in 7 files** to **3 tests in 3 files**, add **2 Vitest backfills**, stabilize the retained specs, then flip CI from optional skip to **required hard gate**. Dev-mode auth stack and production selectors stay.

---

## Phase 1 — Portfolio cut + cheaper backfills + stabilization

Do this before enabling the CI gate.

### 1a. Delete E2E spec files (4)

| File                             | Reason                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| `e2e/happy-split.spec.ts`        | Tier B; Vitest covers claim math and join URL                 |
| `e2e/final-readonly.spec.ts`     | Both scenarios removed; host half replaced by Vitest backfill |
| `e2e/guest-item-sharing.spec.ts` | Tier B; `shared/guest-share-preview.test.ts` owns share math  |
| `e2e/host-paid-summary.spec.ts`  | Tier B/C; host paid-by-rule rules covered in unit tests       |

### 1b. Reshape retained spec (1 file)

**`e2e/combined-guest-payment.spec.ts`** — keep only `host banner hidden until guest opens Revolut`.

Remove from this file:

- Tests: solo pay, combined confirm both, cancel pending, triple combined pay
- Helpers used only by removed tests: `assertParticipantPaid`, `startGuestCombinedPayment`, `setupTripleCombinedPaymentBill`, `TriplePaySetup`

Keep:

- `setupCombinedPaymentBill`, `configureRevolut`, `getJoinUrl`, banner test body
- Imports from `./helpers/bill-editor`, `./helpers/claim-drawer`, `./helpers/host-auth`

**Stabilization (required before Phase 2):**

- Investigate and fix the 180s timeout failure recorded in [Establish the E2E suite's observed reliability and operating cost](https://github.com/HayGrouve/onova-za-smetkata/issues/46) (banner visibility / cross-context sync)
- Re-run `pnpm run test:e2e` until all **3** specs pass reliably locally (repeat run recommended)
- Drop file-level `test.setTimeout(180_000)` if default `120_000` in `playwright.config.ts` suffices after fix

### 1c. Trim E2E helpers (2 files)

**`e2e/helpers/bill-editor.ts`** — remove exports only used by deleted specs:

- `getHostParticipantName`
- `splitFirstItemEvenly`

Keep: `billIdFromUrl`, `goToBillStep`, `expectBillItemVisible`, `assignFirstItemToParticipants`

**`e2e/helpers/claim-drawer.ts`** — remove exports only used by deleted specs:

- `claimHalfOfItem`
- `claimQty1Item`
- `goBackFromHostClaim`

Keep: `expandClaimShareDrawer`, `collapseClaimShareDrawer`, `selectCombinedPayChip`, `initiateRevolutPayment`

### 1d. Unchanged E2E files (4)

| File                              | Role                                     |
| --------------------------------- | ---------------------------------------- |
| `e2e/session-conflict.spec.ts`    | Retained tier-A                          |
| `e2e/claim-search-drawer.spec.ts` | Retained tier-A                          |
| `e2e/helpers/host-auth.ts`        | Host auto-sign-in for all retained specs |
| `e2e/README.md`                   | Update (see Phase 1e)                    |

### 1e. Vitest backfills (2 new tests)

**Taken-seat join logic**

- Extract pure helper from `src/routes/bills/$billId/join.tsx`:

  ```ts
  // src/lib/join-taken-seats.ts
  buildTakenParticipantIds(
    activeSessions: { participantId: string }[] | undefined,
    ownParticipantId: string | undefined,
  ): Set<string>
  ```

  Logic: all active session `participantId`s except the viewer's own stored session id (matches current `useMemo` in join route).

- Add `src/lib/join-taken-seats.test.ts` — cases: no sessions, one other session taken, own session excluded, multiple taken.
- Refactor `join.tsx` to call the extracted helper.

**Host summary controls after finalize**

- Add `src/components/bills/payment-actions.test.tsx` with `@vitest-environment jsdom` (project already has `@testing-library/react` + `jsdom`; no new deps).
- Mock Convex mutations (`useMutation`) and `useConfirmAction`.
- Assert when `readOnly={true}` with existing payments: **no** `Отмени последно плащане`, **no** `Платено`; payment history list still renders.
- Assert when `readOnly={false}` with balance remaining: undo and mark-paid controls render.

This replaces the removed host half of `final-readonly.spec.ts` at the component layer (`PaymentActions` is what `PaymentRow` passes `readOnly={!isDraft}` from `bill-summary-content.tsx`).

### 1f. Docs touch (Phase 1)

**`e2e/README.md`**

- State **3** critical-path specs
- Note upcoming required CI gate (Phase 2)
- Keep dev Convex + `DEV_MODE` prerequisites unchanged

---

## Phase 2 — CI hard gate (after Phase 1 green)

### 2a. `.github/workflows/ci.yml` `e2e` job

| Change                  | Detail                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| Remove skip path        | Delete the `Skip when E2E secret unset` step and all `if: env.VITE_CONVEX_URL != ''` guards on subsequent steps |
| Fail if secret missing  | First step: exit 1 when `secrets.E2E_VITE_CONVEX_URL` is empty with a clear message                             |
| Keep job structure      | checkout → pnpm → `test:e2e:install` → `test:e2e`; env `VITE_CONVEX_URL` + `CI: true`                           |
| Parallel with preflight | Do **not** add `needs: [preflight]` unless flake debugging requires it — keep current parallelism               |
| Deploy unchanged        | `deploy-convex` / `deploy-vercel` stay `needs: [preflight]` only                                                |

### 2b. GitHub repo settings (manual, outside repo diff)

- Add repository secret `E2E_VITE_CONVEX_URL` → dev Convex deployment URL with `DEV_MODE=true`
- Mark the **`e2e`** job as a **required status check** on `main` PRs (branch protection)

### 2c. Convex ops (manual)

- Maintain a dedicated **non-production** Convex deployment for CI E2E
- Ensure `DEV_MODE=true` and Password provider remain enabled on that deployment

### 2d. Docs touch (Phase 2)

| File                                      | Change                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `docs/DEPLOY.md` § “E2E in CI (optional)” | Rename/reword to **required** PR gate; document secret as mandatory; note deploy jobs still independent |
| `README.md`                               | Update Playwright line: 3-spec critical-path gate, not optional smoke                                   |

---

## Keep as-is (shared / non–E2E-only)

Do **not** remove or weaken these during cleanup:

| Artifact                                                                                                                       | Why                 |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| `convex/lib/devMode.ts`, `DEV_MODE` env, Password provider in `convex/auth.ts`                                                 | Local dev auth      |
| `src/components/auth/dev-auto-sign-in.tsx`, `src/hooks/use-require-host-auth.ts`, `src/lib/dev-mode.ts`, `src/lib/dev-user.ts` | Dev auto sign-in    |
| `convex/lib/devMode.test.ts`                                                                                                   | Dev-mode guardrails |
| `data-testid="join-url"` on invite card                                                                                        | Production hook     |
| `.guest-claim-card`, `.guest-total-pulse`, `data-testid="claim-share-details"`                                                 | Production UI       |

No test-only application hooks beyond existing dev-mode stack need removal — there are none exclusive to E2E.

---

## Retained Playwright toolchain

| Artifact                                        | Action                                                     |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `playwright.config.ts`                          | Keep; tune timeouts/retries only if stabilization requires |
| `@playwright/test` in `package.json` / lockfile | Keep                                                       |
| Scripts `test:e2e`, `test:e2e:install`          | Keep                                                       |
| `vite.config.ts` `e2e/**` vitest exclude        | Keep (harmless)                                            |

Optional CI improvement (not blocking): upload Playwright trace on failure — not in current config.

---

## Explicitly out of implementation scope

| Item                                          | Reason                                     |
| --------------------------------------------- | ------------------------------------------ |
| `docs/superpowers/**` historical E2E mentions | Archive context; no runtime effect         |
| Vaul drawer component backfill                | Retained claim-search-drawer E2E covers it |
| Changing production deploy to depend on E2E   | Map decision: PR gate only                 |
| Removing dev-mode auth stack                  | Shared with local dev (#47)                |

---

## Verification checklist (implementer)

- [ ] `pnpm run test` — includes new `join-taken-seats` and `payment-actions` tests
- [ ] `pnpm run preflight` — green
- [ ] `pnpm run test:e2e` — exactly **3** tests pass locally against dev Convex + `DEV_MODE`
- [ ] Repeat local E2E run or short loop — combined-pay banner stable
- [ ] CI with `E2E_VITE_CONVEX_URL` set — `e2e` job runs and passes
- [ ] CI with secret unset (pre-Phase-2 check only) — fails loudly, not skip-green
- [ ] Branch protection requires `e2e` check on PRs

---

## Expected file diff footprint

```
D  e2e/happy-split.spec.ts
D  e2e/final-readonly.spec.ts
D  e2e/guest-item-sharing.spec.ts
D  e2e/host-paid-summary.spec.ts
M  e2e/combined-guest-payment.spec.ts
M  e2e/helpers/bill-editor.ts
M  e2e/helpers/claim-drawer.ts
M  e2e/README.md
M  src/routes/bills/$billId/join.tsx
A  src/lib/join-taken-seats.ts
A  src/lib/join-taken-seats.test.ts
A  src/components/bills/payment-actions.test.tsx
M  .github/workflows/ci.yml          (Phase 2)
M  docs/DEPLOY.md                    (Phase 2)
M  README.md                         (Phase 2)
```

Net: **−4** spec files, **−10** E2E scenarios, **+2** Vitest files, **~3** retained browser tests.
