# Guidance focus prototype (wayfinder #70)

**Question:** What implementation shape should replace the ad-hoc scroll refs in the bill route (`shouldScrollToOcrRef`, `queueScrollToBillDetails`, etc.)?

**Answer shape:** A **`useGuidanceFocus` hook** + **`GuidanceTarget` wrapper** that:

1. Reads `currentGuidanceStep` from `deriveHostOnboardingGuidance`
2. Registers DOM targets via `data-guidance-target`
3. Runs shared scroll+pop timing (`scroll-pop-target.ts`) with reduced-motion branches (#72)
4. Chains when the active step id changes (step completes → next incomplete step)
5. Forward auto-nav via `planGuidanceAutoNavigation` (#69)

Pure planning logic lives in `plan-guidance-focus.ts` (portable to `shared/` on implementation).

## Run

Interactive demo (mock bill steps 1–2):

```bash
pnpm run prototype:guidance-focus
```

Bill route integration (partial — OCR, restaurant, participants) runs under active Host onboarding in dev.

## Files

| File                     | Role                                            |
| ------------------------ | ----------------------------------------------- |
| `plan-guidance-focus.ts` | Pure: active step, auto-nav gate, scroll blocks |
| `scroll-pop-target.ts`   | DOM scroll+pop sequence                         |
| `use-guidance-focus.ts`  | React hook                                      |
| `guidance-target.tsx`    | Target registration wrapper                     |
