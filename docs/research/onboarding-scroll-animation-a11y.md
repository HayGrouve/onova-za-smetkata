# Accessibility: programmatic scroll & animation for Host onboarding

Research for wayfinder ticket **#72**. Related conformance target: issue **#62** (WCAG 2.2 AA for onboarding).

**Scope:** Mobile web PWA patterns for `scrollIntoView`, highlight “pop” animations, focus management, and screen-reader announcements during first-run Host onboarding (bill route step bar, content-route choice, OCR scroll target).

**Current implementation (baseline):**

- Auto `scrollIntoView({ behavior: 'smooth', block: 'center' | 'start' })` after layout settles (`src/routes/bills/$billId/index.tsx`).
- Decorative scale “pop” via `.content-route-choice-pop` (420 ms, max scale 1.08) gated under `@media (prefers-reduced-motion: no-preference)` in `src/styles.css`; global reduced-motion override zeroes animation duration.
- Persistent step-bar guidance text (“Следваща стъпка: …” + “Към стъпка N” button) in `BillStepsBar`; no programmatic focus move on auto-scroll.
- Modal sheets (welcome, payment checkpoint) use Radix `Sheet`; OCR bar uses `aria-live="polite"`.

---

## 1. `prefers-reduced-motion`: scroll vs pop

### What the standards say

| Concern                 | Level       | Requirement / guidance                                                                                                                                                                                                                           | Source                                                                                                                            |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Motion from interaction | AAA (2.3.3) | Motion animation triggered by interaction must be disableable unless essential to functionality or information. Scrolling content into the viewport is **essential**; **non-essential** animation added to scroll should respect reduced motion. | [WCAG 2.3.3 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)                          |
| Auto-started motion     | A (2.2.2)   | Moving/blinking/scrolling that starts automatically, lasts **> 5 s**, and runs in parallel with other content needs pause/stop/hide unless essential. Short onboarding pop (~420 ms) is below this threshold.                                    | [WCAG 2.2.2 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)                                      |
| Indirect interaction    | A / AAA     | Content that starts from **indirect** interaction (e.g. scrolling an element into view) is in scope for 2.2.2 and may also fail 2.3.3.                                                                                                           | [WCAG 2.2.2 Understanding — note on indirect interaction](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)       |
| CSS technique           | —           | Disable motion inside `@media (prefers-reduced-motion: reduce)` or only enable under `no-preference`.                                                                                                                                            | [WCAG C39](https://www.w3.org/WAI/WCAG22/techniques/css/C39.html)                                                                 |
| JS technique            | —           | Evaluate `matchMedia('(prefers-reduced-motion: no-preference)')` before running JS-driven animation; suppress non-essential motion when reduce is set.                                                                                           | [WCAG SCR40](https://www.w3.org/WAI/WCAG22/techniques/client-side-script/SCR40.html)                                              |
| Vestibular triggers     | —           | Scaling / panning animations are common vestibular triggers; `prefers-reduced-motion: reduce` should remove or replace them.                                                                                                                     | [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) |

### Recommendations for this PWA

| Behavior                 | `no-preference`                                                                                            | `reduce`                                                                                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scroll to target**     | Keep scroll — users must see the referenced control. Use `behavior: 'smooth'` if desired.                  | **Keep scroll** (essential). Use `behavior: 'auto'` (instant) via `matchMedia` per SCR40 — avoids vestibular discomfort from smooth scrolling.                                                                                                                         |
| **Pop highlight**        | Scale pop is acceptable decorative emphasis (< 5 s, non-flashing).                                         | **Skip pop animation**; apply a **static** affordance instead (e.g. persistent `outline` / border emphasis on the target or its container). Repo CSS already suppresses animation duration; JS should still apply the static highlight and run any “seen” bookkeeping. |
| **Page step transition** | Existing fade/slide on step change (`animate-in`) is under `no-preference` block + global reduce override. | Instant step swap is fine; no extra motion needed.                                                                                                                                                                                                                     |

**Do not** skip scrolling under reduced motion — locating the next action is functional, not decorative ([WCAG 2.3.3 — essential scrolling movement is allowed](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)).

**Do not** rely on smooth scroll when `reduce` is active — treat `scrollIntoView({ behavior: 'smooth' })` as a motion effect controllable by SCR40.

---

## 2. Focus management: move focus vs visual-only highlight

### What the standards say

| Concern            | Level       | Requirement / guidance                                                                                                                                               | Source                                                                                                                                                                                |
| ------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focus order        | A (2.4.3)   | Focusable components receive focus in an order that preserves meaning. Avoid confusing jumps; programmatic focus on non-operable wrappers is discouraged.            | [WCAG 2.4.3 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)                                                                                              |
| Focus visible      | AA (2.4.7)  | Keyboard focus indicator must be visible; do not remove focus on receipt (F55).                                                                                      | [WCAG 2.4.7 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)                                                                                            |
| Focus not obscured | AA (2.4.11) | When a component receives keyboard focus, it must not be **entirely** hidden by author-created content (sticky headers/footers). Use scroll padding or displacement. | [WCAG 2.4.11 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), [C43 scroll-padding](https://www.w3.org/WAI/WCAG22/techniques/css/C43.html) |
| Modal onboarding   | —           | On dialog open: move focus inside; on close: restore focus to trigger. Use `aria-modal`, label, describe.                                                            | [APG Modal Dialog Example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/)                                                                                    |
| Focus vs scroll    | —           | `element.focus()` scrolls by default; use `focus({ preventScroll: true })` when focus should not move the viewport.                                                  | [MDN `HTMLElement.focus()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)                                                                                       |

### Recommendations for this PWA

**Auto scroll + pop (system-initiated, after OCR upload, content-route choice, etc.)**

- **Visual-only highlight** — do **not** programmatically move focus to the scroll target. Auto-focus mid-flow disorients screen-reader and keyboard users and breaks reading order ([WCAG 2.4.3 best practice](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)).
- Pair visual scroll with **persistent, operable guidance** already in the sticky step bar (“Следваща стъпка: …” + “Към стъпка N”).

**User-initiated navigation (“Към стъпка N”, step bar buttons, content-route choice buttons)**

- Moving focus is appropriate **after explicit activation**: e.g. focus the first primary control in the destination step (APG dialog pattern: focus goes where the user expects to act next).
- When focusing without re-scrolling, use `preventScroll: true` if scroll already happened.

**Sticky chrome**

- `BillStepsBar` is `sticky top-14 z-30`. Add **`scroll-padding-top`** on `html` (in addition to existing `scroll-padding-bottom`) so keyboard-focused targets below the bar are not fully obscured ([WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)).

**Sheets (welcome, payment checkpoint)**

- Follow modal dialog focus trap and return-focus-on-close per APG; separate from inline scroll/highlight behavior.

---

## 3. WCAG 2.2 AA alignment for onboarding motion

Issue **#62** targets **WCAG 2.2 AA**. Criteria most relevant to scroll + pop:

| Criterion                               | Level               | Onboarding impact                                                                                                                                                                                                         |
| --------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.2.2** Pause, Stop, Hide             | A                   | Short auto pop and scroll retries are **not** required to expose pause controls (< 5 s). Long-running OCR indeterminate bar should stay stoppable via page context; existing static fallback under reduce in CSS is good. |
| **2.3.1** Three Flashes                 | A                   | Single scale pop (≈2.4 Hz effective) is not a flash risk.                                                                                                                                                                 | [WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) |
| **2.4.3** Focus Order                   | A                   | No auto-focus on scroll; user-initiated step jumps manage focus deliberately.                                                                                                                                             |
| **2.4.7** Focus Visible                 | AA                  | Any temporary highlight on a **focusable** control should not replace the focus ring when user tabs there.                                                                                                                |
| **2.4.11** Focus Not Obscured (Minimum) | AA (**new in 2.2**) | Sticky step bar + safe-area chrome must leave focused targets partially visible — scroll padding / scroll-into-view `block` alignment.                                                                                    |
| **1.4.11** Non-text Contrast            | AA                  | Pop outline / focus indicator vs background ≥ 3:1.                                                                                                                                                                        |
| **2.3.3** Animation from Interactions   | AAA (not AA)        | Not required for AA conformance, but honoring `prefers-reduced-motion` matches user expectations and C39/SCR40 techniques.                                                                                                |

**Conformance posture:** AA requires handling focus visibility and obscuring (2.4.7, 2.4.11) and not blocking operation with uncontrolled long motion (2.2.2). Reduced-motion support is **strongly recommended** even though 2.3.3 is AAA.

---

## 4. Screen reader announcement strategy

### What the standards say

| Topic             | Guidance                                                                                                                                      | Source                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Live regions      | `aria-live` announces updates **without moving focus**. Use `polite` for non-urgent status; `assertive` only when interruption is imperative. | [MDN `aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live) |
| Live region setup | Container should exist in DOM before updates; use `aria-atomic="true"` when the whole message must be read.                                   | [WCAG ARIA19](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19.html)                                          |
| Progress / status | Progressbar role alone does not announce value changes; pair with live region text if SR should hear updates without focus.                   | [WCAG ARIA25](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA25.html)                                          |
| Live region roles | `status` / `log` imply `aria-live="polite"`.                                                                                                  | [WAI-ARIA 1.2 — live regions](https://www.w3.org/TR/wai-aria-1.2/#live_region_roles)                              |

### What auto-scroll does _not_ do

`scrollIntoView` only changes viewport position. Screen readers **do not** automatically announce scrolled-into-view content unless focus moves there or a live region fires. MDN and ARIA25 both emphasize that dynamic updates need an explicit live-region or focus strategy.

### Recommendations for this PWA

**Prefer layered announcement — avoid duplication:**

1. **Step bar guidance (primary channel)**  
   When `stepBarSignal` changes to `pointer` or step text updates, expose a dedicated **`aria-live="polite"`** + **`aria-atomic="true"`** region in the sticky step bar (e.g. wrap the “Следваща стъпка: …” line). This announces the _task_ without repeating full card copy.

2. **Inline guidance cards (secondary, static)**  
   Cards like `ContentRouteChoice` and scan hints already have visible title + body in the DOM. Screen-reader users who explore the page will read them normally. **Do not** mirror the full card into a live region on every scroll — that duplicates speech.

3. **When to add a targeted live announcement**
   - Step **changes** (1 → 2 → 3): polite one-liner via step bar live region.
   - **OCR lifecycle** (uploading / scanning): keep existing `OcrActivityBar` `aria-live="polite"` pattern.
   - **Pop highlight alone**: no live announcement — insufficient information; the step-bar line should already name the next action.

4. **Avoid `assertive`** for onboarding hints — not time-critical ([MDN warning on assertive](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live)).

5. **Modal sheets**  
   Welcome / payment checkpoint: rely on dialog titling + `aria-describedby` (APG), not live regions.

---

## 5. Implementation checklist (Host onboarding scroll + pop)

- [x] **`matchMedia('(prefers-reduced-motion: reduce)')`** → `scrollIntoView({ behavior: 'auto', … })`; else `smooth`. (`src/lib/guidance-focus/scroll-pop-target.ts`)
- [x] **Under reduce:** skip pop class; apply static border/outline highlight (`use-guidance-focus.ts` → `reducedHighlightStepId`).
- [x] **Do not auto-focus** on programmatic scroll (`use-guidance-focus.ts`).
- [x] Add **`scroll-padding-top`** for sticky header + step bar (`src/styles.css`).
- [x] Add **`aria-live="polite"`** + **`aria-atomic="true"`** on step-bar next-step guidance (`bills/$billId/index.tsx`).
- [ ] Verify pop highlight meets **1.4.11** contrast under reduced motion (manual/visual QA).

---

## 6. Summary recommendations (for implementers)

1. **Scroll always; animate conditionally** — instant scroll under `prefers-reduced-motion: reduce`, smooth otherwise; never drop scroll because motion is reduced.
2. **Pop is decorative** — disable scale pop under reduce; substitute static emphasis; keep duration under 5 s for everyone else.
3. **No focus steal on auto-scroll** — use step-bar live region + operable “Към стъпка N”; move focus only on explicit user navigation.
4. **Account for sticky UI** — `scroll-padding-top` so keyboard focus is not fully hidden by the step bar (WCAG 2.4.11).
5. **Announce step intent once** — polite, atomic live region on the step bar; let inline cards remain discoverable static content.

---

## Sources

- [WCAG 2.2.2 Pause, Stop, Hide — Understanding](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [WCAG 2.3.1 Three Flashes — Understanding](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- [WCAG 2.3.3 Animation from Interactions — Understanding](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
- [WCAG 2.4.3 Focus Order — Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
- [WCAG 2.4.7 Focus Visible — Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- [WCAG 2.4.11 Focus Not Obscured (Minimum) — Understanding](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [WCAG C39 — `prefers-reduced-motion` in CSS](https://www.w3.org/WAI/WCAG22/techniques/css/C39.html)
- [WCAG C43 — scroll-padding](https://www.w3.org/WAI/WCAG22/techniques/css/C43.html)
- [WCAG SCR40 — `prefers-reduced-motion` in JavaScript](https://www.w3.org/WAI/WCAG22/techniques/client-side-script/SCR40.html)
- [WCAG ARIA19 — live regions for errors](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19.html)
- [WCAG ARIA25 — live region for progress status](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA25.html)
- [WAI-ARIA 1.2 — live regions](https://www.w3.org/TR/wai-aria-1.2/#live_region_roles)
- [APG Modal Dialog Example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/)
- [MDN — `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- [MDN — `Element.scrollIntoView()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)
- [MDN — `HTMLElement.focus()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)
- [MDN — `aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live)
