# Guidance focus prototype (wayfinder #70)

**Question:** What implementation shape should replace the ad-hoc scroll refs in the bill route (`shouldScrollToOcrRef`, `queueScrollToBillDetails`, etc.)?

**Answer shape:** A **`useGuidanceFocus` hook** + **`GuidanceTarget` wrapper** that:

1. Reads `currentGuidanceStep` from `deriveHostOnboardingGuidance`
2. Registers DOM targets via `data-guidance-target`
3. Runs shared scroll+pop timing (`scroll-pop-target.ts`) with reduced-motion branches (#72)
4. Chains when the active step id changes (step completes → next incomplete step)
5. Pops the step nav **„Напред“** button when all hints for the current editor step complete (#69) — no forward auto-nav; user taps Next manually

Pure planning logic lives in `plan-guidance-focus.ts` and `plan-next-button-pop.ts` (portable to `shared/` on implementation).

## Run

Interactive demo (mock bill steps 1–2):

```bash
pnpm run prototype:guidance-focus
```

Bill route integration (partial — OCR, restaurant, participants) runs under active Host onboarding in dev.

## Files

| File                      | Role                                               |
| ------------------------- | -------------------------------------------------- |
| `plan-guidance-focus.ts`  | Pure: active step, scroll blocks, timing constants |
| `plan-next-button-pop.ts` | Pure: next-button pop queue / deferral             |
| `scroll-pop-target.ts`    | DOM scroll+pop sequence                            |
| `use-guidance-focus.ts`   | React hook                                         |
| `guidance-target.tsx`     | Target registration wrapper                        |

## Next-button pop (bill route)

- Trigger: `isEditorStepGuidanceComplete(steps, editorStep, dismissedHintIds)` transitions to true
- Defer while receipt review sheet is open; after close, wait `SHEET_CLOSE_SETTLE_MS` (350ms)
- Defer while add-guest input is focused
- Animation: wrapper div around „Напред“ (not the `Button` — avoids transform/transition conflict)
