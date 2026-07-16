# Claim Share Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-expanded claim footer („Разбивка на дяла“) with a persistent Vaul bottom drawer: peek shows amount + pay actions; swipe/tap expands to line items (+ guest chips) with a sticky summary bar.

**Architecture:** Install `vaul` and a thin `drawer.tsx` wrapper (do **not** use the latest shadcn Drawer — it is Base UI and lacks snap points). Add `ClaimShareDrawer` shell (snap points, handle, scrim, list spacer). Refactor `GuestClaimFooter` and `HostClaimFooter` to compose it without changing payment mutations.

**Tech Stack:** React 19, Vaul, Vitest, existing Shadcn tokens/`sticky-surface`, TanStack Router claim routes

**Spec:** `docs/superpowers/specs/2026-07-16-claim-share-drawer-design.md`

## Global Constraints

- Guest **and** host claim pages share one drawer shell
- Default snap = peek; drawer never fully closes (`open`, `dismissible={false}`)
- Peek: amount + pay actions; pending transfer + Cancel stay in peek
- Expanded: item lines + „Плати и за“ chips; sticky summary at bottom of drawer
- List spacer = peek height only (expand overlays the claim list)
- `modal={false}` so peek does not block claiming; custom scrim only when expanded
- Bulgarian UI copy unchanged except chrome/layout
- Payment / assignment Convex APIs unchanged
- Out of scope: mid snap, persist snap, step-4 summary Revolut, business-rule changes

---

## File map

| File | Responsibility |
|------|----------------|
| `package.json` / lockfile | Add `vaul` dependency |
| `src/components/ui/drawer.tsx` | Thin Vaul wrappers (`Drawer`, `DrawerContent`, …) with project aliases |
| `src/lib/claim-share-drawer.ts` | Pure snap helpers (testable) |
| `src/lib/claim-share-drawer.test.ts` | Vitest for snap helpers |
| `src/components/bills/claim-share-drawer.tsx` | Shared shell: snaps, handle, scrim, spacer, slots |
| `src/components/bills/host-claim-footer.tsx` | Compose shell; host summary in peek; lines in details |
| `src/components/bills/guest-claim-footer.tsx` | Compose shell; chips in details; pay + pending in summary |

---

### Task 1: Vaul dependency + UI drawer wrappers

**Files:**
- Modify: `package.json` (via pnpm)
- Create: `src/components/ui/drawer.tsx`

**Interfaces:**
- Produces: `Drawer`, `DrawerPortal`, `DrawerOverlay`, `DrawerTrigger`, `DrawerClose`, `DrawerContent`, `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription` — re-export/wrap `vaul` primitives styled like existing sheet (zinc tokens, `sticky-surface` where appropriate).

- [ ] **Step 1: Install vaul**

```bash
pnpm add vaul
```

Expected: `vaul` appears in `package.json` dependencies.

- [ ] **Step 2: Add drawer wrappers**

Create `src/components/ui/drawer.tsx` based on the classic Vaul shadcn pattern (not Base UI). Essential shape:

```tsx
import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { cn } from '#/lib/utils.ts'

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-xl border bg-background',
          className,
        )}
        {...props}
      >
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  )
}

// Also wrap: Portal, Overlay, Trigger, Close, Header, Footer, Title, Description
// Match export style of src/components/ui/sheet.tsx (named exports, data-slot attrs).

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
```

Do **not** run `pnpm dlx shadcn@latest add drawer` unless you verify the generated file still uses Vaul with `snapPoints` — current shadcn docs generate Base UI.

- [ ] **Step 3: Typecheck the new module**

```bash
pnpm exec tsc --noEmit -p . 2>&1 | rg "drawer\.tsx" || true
```

Expected: no errors mentioning `drawer.tsx`.

- [ ] **Step 4: Commit** (if the user asked for commits)

```bash
git add package.json pnpm-lock.yaml src/components/ui/drawer.tsx
git commit -m "$(cat <<'EOF'
feat: add Vaul drawer UI wrappers for claim share snaps

EOF
)"
```

---

### Task 2: Snap helpers (TDD)

**Files:**
- Create: `src/lib/claim-share-drawer.ts`
- Create: `src/lib/claim-share-drawer.test.ts`

**Interfaces:**
- Produces:
  - `CLAIM_SHARE_EXPANDED_FRACTION = 0.7` (number snap = fraction of viewport)
  - `buildClaimShareSnapPoints(peekHeightPx: number): Array<number | string>`  
    → `[`${Math.round(peekHeightPx)}px`, CLAIM_SHARE_EXPANDED_FRACTION]`
  - `isClaimShareExpanded(activeSnapPoint: number | string | null, snapPoints: Array<number | string>): boolean`  
    → true when active equals the expanded snap (index 1)

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/claim-share-drawer.test.ts
import { describe, expect, it } from 'vitest'
import {
  CLAIM_SHARE_EXPANDED_FRACTION,
  buildClaimShareSnapPoints,
  isClaimShareExpanded,
} from './claim-share-drawer'

describe('buildClaimShareSnapPoints', () => {
  it('uses rounded px for peek and fraction for expanded', () => {
    expect(buildClaimShareSnapPoints(142.7)).toEqual([
      '143px',
      CLAIM_SHARE_EXPANDED_FRACTION,
    ])
  })
})

describe('isClaimShareExpanded', () => {
  const snaps = buildClaimShareSnapPoints(120)

  it('is false on peek snap', () => {
    expect(isClaimShareExpanded(snaps[0]!, snaps)).toBe(false)
  })

  it('is true on expanded snap', () => {
    expect(isClaimShareExpanded(snaps[1]!, snaps)).toBe(true)
  })

  it('is false when active is null', () => {
    expect(isClaimShareExpanded(null, snaps)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm exec vitest run src/lib/claim-share-drawer.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement helpers**

```ts
// src/lib/claim-share-drawer.ts
export const CLAIM_SHARE_EXPANDED_FRACTION = 0.7

export function buildClaimShareSnapPoints(
  peekHeightPx: number,
): Array<number | string> {
  const peek = `${Math.round(peekHeightPx)}px`
  return [peek, CLAIM_SHARE_EXPANDED_FRACTION]
}

export function isClaimShareExpanded(
  activeSnapPoint: number | string | null,
  snapPoints: Array<number | string>,
): boolean {
  if (activeSnapPoint == null) return false
  return activeSnapPoint === snapPoints[1]
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm exec vitest run src/lib/claim-share-drawer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit** (if requested)

```bash
git add src/lib/claim-share-drawer.ts src/lib/claim-share-drawer.test.ts
git commit -m "$(cat <<'EOF'
feat: add claim share drawer snap helpers

EOF
)"
```

---

### Task 3: `ClaimShareDrawer` shell

**Files:**
- Create: `src/components/bills/claim-share-drawer.tsx`
- Modify: none yet (footers in later tasks)

**Interfaces:**
- Consumes: `buildClaimShareSnapPoints`, `isClaimShareExpanded` from `#/lib/claim-share-drawer.ts`; Vaul via `#/components/ui/drawer.tsx`
- Produces:

```ts
export type ClaimShareSnap = 'peek' | 'expanded'

export interface ClaimShareDrawerProps {
  title: React.ReactNode
  status?: React.ReactNode
  /** Sticky bottom region: amount + pay / host note (+ pending). */
  summary: React.ReactNode
  /** Expanded-only scroll region: breakdown lines (+ chips). */
  details: React.ReactNode
  snap?: ClaimShareSnap
  onSnapChange?: (snap: ClaimShareSnap) => void
  /** Fallback peek height before measure (px). Default 160. */
  initialPeekHeightPx?: number
}
```

Behavior requirements (implement all):

1. `Drawer` always `open`, `modal={false}`, `dismissible={false}`, `snapPoints={...}`, controlled `activeSnapPoint` / `setActiveSnapPoint`.
2. Uncontrolled default: start at peek. If `snap` prop provided, sync active snap from it.
3. Measure a **peek chrome** ref that wraps handle + title row + `summary` (not `details`) with `ResizeObserver`; rebuild snap points when height changes; keep spacer = that height.
4. Layout inside content:
   - drag handle (button) toggles peek ↔ expanded; `aria-expanded={expanded}`; `aria-controls` pointing at details region id
   - title row
   - when expanded: scrollable `details` (`data-testid="claim-share-details"`, `id` for a11y)
   - sticky `summary` always at bottom of drawer content
5. When expanded: render a fixed inset-0 `z-40` scrim (`bg-black/40`) under the drawer (`z-50`); click → set peek. No scrim at peek.
6. Render `aria-hidden` spacer div with measured peek height so claim list scrolls clear of the peek bar.
7. Cap content with `max-h-[min(75dvh,36rem)]` on the drawer content; details area `overflow-y-auto` / `min-h-0`.
8. Safe area: `pb-[calc(1rem+env(safe-area-inset-bottom,0px))]` on content.
9. Use `sticky-surface` + border-t on content to match current footer.

- [ ] **Step 1: Implement `ClaimShareDrawer`**

Sketch (fill in imports/cn/handle markup to match repo style):

```tsx
// src/components/bills/claim-share-drawer.tsx
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Drawer, DrawerContent } from '#/components/ui/drawer.tsx'
import {
  buildClaimShareSnapPoints,
  isClaimShareExpanded,
} from '#/lib/claim-share-drawer.ts'
import { cn } from '#/lib/utils.ts'

export type ClaimShareSnap = 'peek' | 'expanded'

export interface ClaimShareDrawerProps {
  title: React.ReactNode
  status?: React.ReactNode
  summary: React.ReactNode
  details: React.ReactNode
  snap?: ClaimShareSnap
  onSnapChange?: (snap: ClaimShareSnap) => void
  initialPeekHeightPx?: number
}

export function ClaimShareDrawer({
  title,
  status,
  summary,
  details,
  snap: snapProp,
  onSnapChange,
  initialPeekHeightPx = 160,
}: ClaimShareDrawerProps) {
  const detailsId = useId()
  const peekChromeRef = useRef<HTMLDivElement>(null)
  const [peekHeightPx, setPeekHeightPx] = useState(initialPeekHeightPx)
  const snapPoints = useMemo(
    () => buildClaimShareSnapPoints(peekHeightPx),
    [peekHeightPx],
  )
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(
    snapPoints[0]!,
  )

  // ResizeObserver on peekChromeRef → setPeekHeightPx
  // Sync snapProp → activeSnapPoint
  // When snapPoints[0] changes, if currently peek, retarget active to new peek px
  // onActiveSnapPointChange → onSnapChange('peek' | 'expanded')

  const expanded = isClaimShareExpanded(activeSnapPoint, snapPoints)

  function toggleSnap() {
    setActiveSnapPoint(expanded ? snapPoints[0]! : snapPoints[1]!)
  }

  return (
    <>
      <div aria-hidden style={{ height: peekHeightPx }} />
      {expanded ? (
        <button
          type="button"
          aria-label="Свий разбивката"
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setActiveSnapPoint(snapPoints[0]!)}
        />
      ) : null}
      <Drawer
        open
        modal={false}
        dismissible={false}
        snapPoints={snapPoints}
        activeSnapPoint={activeSnapPoint}
        setActiveSnapPoint={setActiveSnapPoint}
      >
        <DrawerContent
          className={cn(
            'z-50 max-h-[min(75dvh,36rem)] gap-0 sticky-surface',
            'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
          )}
        >
          <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col px-4 pt-2">
            <div ref={peekChromeRef} className="flex flex-col gap-3">
              <button
                type="button"
                className="mx-auto flex w-full flex-col items-center gap-2"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={toggleSnap}
              >
                <span className="bg-muted mx-auto mt-1 h-1.5 w-10 shrink-0 rounded-full" />
                <span className="flex w-full items-center justify-between gap-3 text-left">
                  <span className="text-base font-semibold">{title}</span>
                  {status}
                </span>
              </button>
              {/* summary is sticky visually at bottom — place summary AFTER details in DOM
                  with order/flex, OR keep summary here for measure and duplicate sticky
                  footer: prefer single summary node at bottom via flex layout: */}
            </div>
            <div
              id={detailsId}
              data-testid="claim-share-details"
              hidden={!expanded}
              className={cn(
                'min-h-0 flex-1 overflow-y-auto',
                !expanded && 'hidden',
              )}
            >
              {details}
            </div>
            <div className="shrink-0 border-t pt-3">{summary}</div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
```

**Important measurement note:** Peek height must include handle + title + **summary** height, not details. Structure the measure ref to wrap only those nodes, or measure `summary` + header separately and sum. Do not include the scrollable details in the peek measurement.

Recommended DOM order for sticky summary:

```tsx
<header+handle />           // measured
{expanded && <details />}   // not measured
<summary />                 // measured (included in peek chrome / second ref)
```

Use one wrapper around header+summary for ResizeObserver when collapsed; when expanded, either keep measuring the same wrapper (details sibling outside it) or freeze peek height after first stable measure + observe summary/header only.

- [ ] **Step 2: Manual smoke in isolation (optional)**

Temporarily render `<ClaimShareDrawer title="Test" summary={<p>Sum</p>} details={<p>Lines</p>} />` on a route, or skip and verify in Task 4/5.

- [ ] **Step 3: Commit** (if requested)

```bash
git add src/components/bills/claim-share-drawer.tsx
git commit -m "$(cat <<'EOF'
feat: add ClaimShareDrawer shell with peek and expanded snaps

EOF
)"
```

---

### Task 4: Wire `HostClaimFooter`

**Files:**
- Modify: `src/components/bills/host-claim-footer.tsx`

**Interfaces:**
- Consumes: `ClaimShareDrawer` from `#/components/bills/claim-share-drawer.tsx`
- Keeps existing mutations (`toggle`, `setUnits`) and `ParticipantBreakdownContent` for lines

- [ ] **Step 1: Refactor host footer to slots**

Remove the fixed `footerRef` / spacer / `max-h` panel. Replace return with:

```tsx
return (
  <ClaimShareDrawer
    title={
      <>
        <PieChartIcon className={ICON.section} aria-hidden />
        Разбивка на дяла
      </>
    }
    status={<Badge variant="outline">платено</Badge>}
    details={
      <ParticipantBreakdownContent
        billId={billId}
        participantId={participantId}
        label={label}
        breakdownInput={breakdownInput}
        totals={{ ...totals, paidCents: 0 }}
        showPaymentActions={false}
        showPayActions={false}
        showStatusBadge={false}
        summaryVariant="claim-footer"
        removableItemLines
        readOnly={readOnly}
        participantLabels={participantLabels}
        onRemoveItem={handleRemoveItem}
        summaryFooter={null}
      />
    }
    summary={
      <>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Дял</p>
            <p className="money font-medium">{formatEur(totals.owedCents)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Остатък</p>
            <p className="money font-medium">{formatEur(0)}</p>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Покрито като домакин
        </p>
      </>
    }
  />
)
```

If `ParticipantBreakdownContent` still renders its own separator/totals when `summaryFooter={null}`, adjust that component **minimally**: when `summaryVariant="claim-footer"` and `summaryFooter == null`, render only the lines block (no duplicate totals). Prefer a small prop like `hideClaimFooterSummary` only if null footer is ambiguous.

- [ ] **Step 2: Manual verify host claim**

1. Open bill → step 3 → **Моите артикули**
2. Peek shows amount + „Покрито като домакин“, most of the list visible
3. Swipe/tap handle → lines appear; summary stays at bottom
4. Tap scrim → peek
5. **Назад** still returns to editor

- [ ] **Step 3: Commit** (if requested)

```bash
git add src/components/bills/host-claim-footer.tsx src/components/bills/participant-breakdown-content.tsx
git commit -m "$(cat <<'EOF'
feat: use claim share drawer on host claim footer

EOF
)"
```

---

### Task 5: Wire `GuestClaimFooter`

**Files:**
- Modify: `src/components/bills/guest-claim-footer.tsx`

**Interfaces:**
- Consumes: `ClaimShareDrawer`
- Payment handlers unchanged (`handleRevolut`, `handleCopyIban`, combined mutations)

- [ ] **Step 1: Split current `summaryFooter` into details vs summary**

**`details` slot:**

- `ParticipantBreakdownContent` lines only (`summaryFooter={null}` / hide claim totals as in Task 4)
- Then: `CombinedPayChips` + covered-guest hint + per-person combined amount lines (everything that today sits above the amount row **except** pending/cancel and the amount+buttons row)

**`summary` slot:**

- Pending transfer hint + Cancel (when `pending && transferInitiated`)
- Amount label + money + Revolut/IBAN buttons
- Helper lines about missing payment method / nothing left to pay / IBAN-only hint

Remove old fixed footer chrome (ref, spacer, outer `max-h` scroll). Title + status badge move into `ClaimShareDrawer` props (`status={<Badge>…</Badge>}`).

- [ ] **Step 2: Manual verify guest claim**

1. Join as guest → claim page
2. Peek: amount + Revolut visible without expanding
3. Expand: lines + „Плати и за“ chips
4. Select a chip while expanded → collapse → peek amount includes covered total
5. Tap Revolut from peek still works
6. After initiating transfer, pending + Cancel visible in peek without expanding

- [ ] **Step 3: Run unit tests**

```bash
pnpm exec vitest run src/lib/claim-share-drawer.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit** (if requested)

```bash
git add src/components/bills/guest-claim-footer.tsx
git commit -m "$(cat <<'EOF'
feat: use claim share drawer on guest claim footer

EOF
)"
```

---

### Task 6: Spec status + QA checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-07-16-claim-share-drawer-design.md` (Status → Complete when done)

- [ ] **Step 1: Walk success criteria from the spec**

- [ ] Default claim view is a short peek; item list has most of the viewport  
- [ ] Expand via swipe/tap without leaving the page  
- [ ] Guest can pay from peek  
- [ ] Guest and host share `ClaimShareDrawer`  
- [ ] Scrim collapses to peek  
- [ ] Safe-area padding OK on notched devices (or browser device mode)

- [ ] **Step 2: Mark spec complete**

Set `**Status:** Complete` in the design spec header.

- [ ] **Step 3: Commit** (if requested)

```bash
git add docs/superpowers/specs/2026-07-16-claim-share-drawer-design.md
git commit -m "$(cat <<'EOF'
docs: mark claim share drawer spec complete

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Vaul snap drawer (not Base UI) | Task 1 |
| Peek amount + pay; chips expanded-only | Tasks 4–5 |
| Pending + Cancel in peek | Task 5 |
| Sticky summary (Approach A) | Task 3 |
| Never fully closes; default peek | Task 3 |
| Scrim → peek | Task 3 |
| Spacer = peek height | Task 3 |
| Shared guest + host shell | Tasks 3–5 |
| Payment APIs unchanged | Tasks 4–5 (layout only) |
| Automated snap helper tests | Task 2 |
| Manual gesture QA | Tasks 4–6 |

## Placeholder / consistency check

- Snap API uses Vaul `activeSnapPoint` / `setActiveSnapPoint` / `snapPoints` throughout.
- Slot names: `summary` + `details` (match spec).
- Expanded fraction constant shared via `CLAIM_SHARE_EXPANDED_FRACTION`.
