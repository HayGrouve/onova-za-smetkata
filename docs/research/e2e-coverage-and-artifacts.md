# E2E coverage and E2E-only artifacts

Audit for [issue #47](https://github.com/HayGrouve/onova-za-smetkata/issues/47), captured on 2026-07-22 at repository HEAD.

## Answer

The suite has **13 browser tests in 7 spec files**. Every scenario exercises a real multi-step host + guest journey against a live Convex dev deployment, but **most business rules are already covered** by Vitest at `shared/`, `src/lib/`, and `convex/lib/`. Cheaper tests own calculations, validation, draft/final guards, join filtering, and search filtering; E2E mostly re-proves that those rules survive routing, auth, realtime sync, and mobile UI wiring.

Against the map’s value rule — *high-impact journey, reliable enough to run regularly, costly to replace at a cheaper layer* — the audit splits like this:

| Tier | Count | Meaning |
| --- | --- | --- |
| **A — strongest unique browser protection** | 3 scenarios | Multi-context UI/integration boundaries with little or no cheaper equivalent |
| **B — partial overlap, some wiring value** | 7 scenarios | Domain logic tested elsewhere; browser adds wizard/navigation/realtime confidence |
| **C — thin smoke, heavy duplication** | 3 scenarios | Critical path smoke where cheaper tests already own the assertions |

Nothing in the suite is a dependable PR gate today ([issue #46](docs/research/e2e-reliability-and-cost.md): CI has never executed the tests). That reliability gap is separate from coverage overlap but weighs against retaining the full 13-test portfolio.

---

## Scenario inventory

### `e2e/happy-split.spec.ts` — guest can claim an item after host setup

**Journey:** Host auto-signs in → creates bill → adds participant → adds item → guest opens join URL → picks seat → claims qty=1 item → sees share breakdown and total.

**High-impact?** Yes — core product loop.

**Cheaper coverage:**

- Claim state / totals: `src/lib/guest-claim-items.test.ts`, `src/lib/bill-calculations.test.ts`
- Join URL shape: `src/lib/bill-join-url.test.ts`
- Host omitted from join list: `shared/joinable-participants.test.ts` (logic only)

**Overlap:** **High.** Amounts, claim selection, and join path logic are unit-tested.

**Unique browser boundary:** Full bill wizard (steps 2–3), Convex persistence, guest claim card click path, `.guest-total-pulse` display after claim.

**Tier:** **B**

---

### `e2e/session-conflict.spec.ts` — second guest sees taken participant name

**Journey:** Host adds one guest seat → guest A claims it → guest B opens same join URL → seat shows **Заето** and button is disabled.

**High-impact?** Medium — prevents double-join confusion.

**Cheaper coverage:** **None.** `src/routes/bills/$billId/join.tsx` derives `takenParticipantIds` from stored guest sessions, but no Vitest covers that wiring or the disabled UI.

**Overlap:** **Low** for the taken-seat behavior itself.

**Unique browser boundary:** Two isolated browser contexts + session storage + join page disabled state.

**Tier:** **A**

---

### `e2e/final-readonly.spec.ts` — finalized bill is read-only on guest claim page

**Journey:** Host sets up bill → guest claims → host marks paid → finalizes → returning guest sees readonly banner and disabled claim controls.

**High-impact?** Yes — protects finalized bill integrity.

**Cheaper coverage:**

- Backend guard: `convex/lib/assertBillDraft.test.ts`, `src/lib/assert-assignment-editable.test.ts`
- Guest message constant: `shared/guest-flow-messages.test.ts`

**Overlap:** **High** for the *rule*; **medium** for guest UI disabled state and banner copy on the claim route.

**Unique browser boundary:** End-to-end finalize flow + guest re-entry after final status.

**Tier:** **B**

---

### `e2e/final-readonly.spec.ts` — finalized bill hides payment undo for host and keeps delete

**Journey:** Same setup → before finalize host sees **Отмени последно плащане** → after finalize undo and **Платено** disappear but **Изтрий** remains.

**High-impact?** Medium — host summary UX after final.

**Cheaper coverage:** Finalization guards are backend-tested; **no unit test** asserts payment-action visibility rules on the host summary after final.

**Overlap:** **Medium.**

**Unique browser boundary:** Host summary step-4 UI state transition across finalize.

**Tier:** **B**

---

### `e2e/guest-item-sharing.spec.ts` — three guests share one qty=1 item with equal split

**Journey:** Three guests sequentially join a shared qty=1 line; each sees updated **Споделено с** preview and descending share (9,00 → 4,50 → 3,00 €).

**High-impact?** Yes — core sharing UX.

**Cheaper coverage:**

- Share math: `shared/guest-share-preview.test.ts` (450 / 300 cent splits, remainder handling)
- Unit membership: `shared/unit-coverage.test.ts`, `src/lib/guest-claim-items.test.ts`

**Overlap:** **High** for amounts; **medium** for sequential multi-guest UI updates.

**Unique browser boundary:** Three browser contexts claiming the same unit in series with live preview copy.

**Tier:** **B**

---

### `e2e/combined-guest-payment.spec.ts` — host banner hidden until guest opens Revolut

**Journey:** Host pre-assigns items → guest selects combined-pay chip → host summary shows no “X плати” banner until guest clicks **Revolut**.

**High-impact?** Medium — avoids false host notifications.

**Cheaper coverage:** `shared/combined-payment.test.ts` validates create/confirm rules, not UI timing.

**Overlap:** **Medium.**

**Unique browser boundary:** Cross-context realtime banner gated on `initiateRevolutPayment` (external link click). Failed in the partial local run recorded by [issue #46](docs/research/e2e-reliability-and-cost.md).

**Tier:** **A**

---

### `e2e/combined-guest-payment.spec.ts` — guest solo pay — host confirms one

**Journey:** Guest pays solo via Revolut → host sees pending banner → confirms → guest marked paid.

**Cheaper coverage:** `validateSoloPaymentCreate`, `validateCombinedPaymentConfirm`, `isAwaitingHostConfirmation` in `shared/combined-payment.test.ts`.

**Overlap:** **High.**

**Unique browser boundary:** Solo Revolut footer → host confirm dialog on summary step 4.

**Tier:** **B**

---

### `e2e/combined-guest-payment.spec.ts` — guest combined pay flow — host confirms both

**Journey:** Guest covers self + one other → host confirms → both participants paid on summary.

**Cheaper coverage:** Extensive combined-payment validators and amount aggregation tests.

**Overlap:** **High.**

**Unique browser boundary:** Combined-pay chip selection + host confirmation affecting two rows.

**Tier:** **B**

---

### `e2e/combined-guest-payment.spec.ts` — guest can cancel pending combined payment

**Journey:** Guest starts combined pay → host sees banner → guest cancels → host reloads → pending UI gone.

**Cheaper coverage:** Combined-payment validation tests; no cheaper test for cancel + host reload clearing pending UI.

**Overlap:** **Medium.**

**Unique browser boundary:** Guest cancel control + host summary pending-state cleanup across reload.

**Tier:** **B**

---

### `e2e/combined-guest-payment.spec.ts` — guest pays for self plus two others — host confirms all three

**Journey:** Triple combined-pay chip selection → host confirms → three paid rows.

**Cheaper coverage:** `validateCombinedPaymentCreate` multi-covered cases in unit tests.

**Overlap:** **High.**

**Unique browser boundary:** Three-chip combined pay UI (extension of the two-person flow).

**Tier:** **C** (incremental over the two-person combined test)

---

### `e2e/host-paid-summary.spec.ts` — host paid-by-rule summary flow

**Journey:** Host not listed on join page → host claims via **Моите артикули** → guest claims half → summary shows host paid-by-rule labels (**Дължи**, **Платено**, **0,00** outstanding) and guest still **неплатено** without Revolut on host summary row.

**High-impact?** Yes — host-as-participant collection model.

**Cheaper coverage:**

- Host always-paid totals: `src/lib/bill-calculations.test.ts` (“always-paid Host collection rule”)
- Step-4 completion with host paid: `shared/bill-step-completion.test.ts`
- Host participant planning / join filtering: `shared/host-bill-participant.test.ts`, `shared/joinable-participants.test.ts`
- Progress excludes host: `src/components/bills/payment-progress.test.ts`

**Overlap:** **Very high** for rules; **medium** for host claim route + summary row affordances.

**Unique browser boundary:** **Моите артикули** host claim path, join-page host absence, summary row button visibility.

**Tier:** **B**

---

### `e2e/host-paid-summary.spec.ts` — guest Revolut still works after host paid-by-rule setup

**Journey:** After host/guest claims, guest pays via Revolut → host confirms → guest paid while host remains paid-by-rule.

**Cheaper coverage:** Same as above + `src/lib/payment-settings.test.ts` (Revolut URL building).

**Overlap:** **High.**

**Unique browser boundary:** Payment flow coexisting with host paid-by-rule summary state.

**Tier:** **C** (incremental over host paid-by-rule summary test + solo pay test)

---

### `e2e/claim-search-drawer.spec.ts` — claim item search stays usable after share drawer expand and collapse

**Journey:** Guest filters items → expands/collapses Vaul share drawer → verifies search field is hittable, focusable, and still filters after real pointer click.

**High-impact?** Medium — claim-page usability regression.

**Cheaper coverage:**

- Search filter logic: `src/lib/guest-claim-items.test.ts` (`filterGuestClaimItemsBySearch`)
- Drawer snap math only: `src/lib/claim-share-drawer.test.ts` (no DOM/focus/overlay tests)

**Overlap:** **Low** for the actual failure mode (Vaul transform, overlay hit-steal, `focusOutside` trap).

**Unique browser boundary:** **Strongest UI-regression test in the suite.** Added in `db5bcc3`; focus fix in `0df72b9` — circumstantial evidence it caught a real bug, though CI never ran it ([issue #46](docs/research/e2e-reliability-and-cost.md)).

**Tier:** **A**

---

## E2E-only artifacts

These exist **only** to support Playwright and should be removed together if the suite is removed:

| Artifact | Location |
| --- | --- |
| Specs and helpers | `e2e/**/*.spec.ts`, `e2e/helpers/*.ts`, `e2e/README.md` |
| Playwright config | `playwright.config.ts` |
| Dev dependency | `@playwright/test` in `package.json` / `pnpm-lock.yaml` |
| Scripts | `test:e2e`, `test:e2e:install` in `package.json` |
| CI job | `.github/workflows/ci.yml` `e2e` job and `E2E_VITE_CONVEX_URL` secret docs |
| Docs references | `README.md` Playwright section; `docs/DEPLOY.md` “E2E in CI (optional)” |
| Build/test exclude | `vite.config.ts` `e2e/**` vitest exclude (harmless if folder gone) |
| Historical specs/plans | `docs/superpowers/**` mentions (archive context, not runtime) |

---

## Shared artifacts E2E depends on but must **not** be removed with the suite

These support **local development**, not just browser tests:

| Artifact | Why it stays |
| --- | --- |
| `convex/lib/devMode.ts`, `DEV_MODE` env, Password provider in `convex/auth.ts` | Local dev auth on allowlisted Convex deployments |
| `src/components/auth/dev-auto-sign-in.tsx`, `src/hooks/use-require-host-auth.ts`, `src/lib/dev-mode.ts`, `src/lib/dev-user.ts` | Auto sign-in and auth bypass during `pnpm run dev` |
| `convex/lib/devMode.test.ts` | Unit tests for dev-mode guardrails |
| `data-testid="join-url"` on `bill-invite-card.tsx` | Accessible hook; useful beyond E2E |
| Product CSS classes `.guest-claim-card`, `.guest-total-pulse` | Production UI styling/selectors, not test harness code |

---

## Gaps cheaper tests could absorb if E2E shrinks or goes

If the portfolio decision removes or reshapes E2E, these are the highest-value cheaper additions **not** present today:

1. **Taken-seat join logic** — unit/integration test for `takenParticipantIds` in `join.tsx` (covers session-conflict intent).
2. **Host summary controls after finalize** — component or route-level test that undo/**Платено** hide and **Изтрий** remains (covers second final-readonly test).
3. **Vaul drawer + search interaction** — component test with mocked drawer open/close verifying search input remains focusable (covers claim-search-drawer intent without full browser farm).

---

## Implication for map #45

- **Retain anything:** at most the **3 tier-A** scenarios (session conflict, combined-pay banner timing, claim-search drawer usability), plus optionally a **single** representative tier-B smoke (happy-split or host-paid-by-rule) if funded as a real CI gate.
- **Remove everything:** delete the E2E-only artifact table above; keep the shared dev-mode stack.
- **Next ticket:** [Choose the sustainable E2E portfolio](https://github.com/HayGrouve/onova-za-smetkata/issues/48) should weigh this overlap audit against the zero-CI-execution reliability finding from [Establish the E2E suite's observed reliability and operating cost](https://github.com/HayGrouve/onova-za-smetkata/issues/46).
