# Redesign R3 — Editor Stepper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the monolithic bill editor into 4 guided steps (Бележка → Участници → Разпределение → Преглед) driven by a `?step=` search param, with a progress bar and sticky step navigation.

**Architecture:** One route (`/bills/$billId/`) renders one of four step panels from URL search state. Summary content is extracted into a shared component used by both step 4 and the existing `/summary` route. Existing child components (`ItemList`, `ParticipantList`, `BillInviteCard`, receipt scan) move unchanged into step panels.

**Tech Stack:** TanStack Router (validateSearch, Link search), React, Tailwind

**Spec:** `docs/superpowers/specs/2026-07-09-redesign-slate-copper-design.md` (§4, §7-R3)

**Depends on:** R1, R2 complete

**Status:** ✅ Complete

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/routes/bills/$billId/index.tsx` (modify) | Step state from URL, renders step panels 1–4 |
| `src/routes/bills/$billId/summary.tsx` (modify) | Thin wrapper around shared summary content |
| `src/components/bills/bill-summary-content.tsx` (new) | Extracted summary body (totals, breakdown, payments, finalize) |
| `src/components/bills/bill-steps-bar.tsx` (new) | 4-segment tappable progress bar |
| `src/components/bills/step-nav-bar.tsx` (new) | Sticky bottom: total + breakdown sheet + Назад/Напред |
| `src/components/bills/totals-breakdown-sheet.tsx` (new) | Breakdown sheet extracted from `StickyTotalsBar` |
| `src/components/bills/sticky-totals-bar.tsx` (delete at end) | Replaced by `StepNavBar` + `TotalsBreakdownSheet` |

---

## Task 1: Step search param

**Files:**
- Modify: `src/routes/bills/$billId/index.tsx`

- [x] **Step 1: Add search validation to the route**

```tsx
export type BillStep = 1 | 2 | 3 | 4

function clampStep(value: unknown): BillStep {
  const n = Number(value)
  if (n === 2 || n === 3 || n === 4) return n
  return 1
}

export const Route = createFileRoute('/bills/$billId/')({
  validateSearch: (search: Record<string, unknown>) => ({
    step: clampStep(search.step),
  }),
  head: () => buildNoIndexHead('Сметка'),
  component: BillEditor,
})
```

- [x] **Step 2: Read step + navigation helper in `BillEditorContent`**

```tsx
const { step } = Route.useSearch()
const navigate = Route.useNavigate()

function goToStep(next: BillStep) {
  void navigate({ search: { step: next }, resetScroll: true })
}
```

- [x] **Step 3: Verify deep link**

Run dev server; open `/bills/<id>/?step=3`. Expected: route loads, `step === 3` (still renders whole page until Task 5).

---

## Task 2: Extract summary content

**Files:**
- Create: `src/components/bills/bill-summary-content.tsx`
- Modify: `src/routes/bills/$billId/summary.tsx`

- [x] **Step 1: Create `BillSummaryContent`**

Move everything from `BillSummary` (in `summary.tsx`) **below** the auth/data loading into the new component. Props carry what the route currently derives:

```tsx
export interface BillSummaryContentProps {
  billId: Id<'bills'>
  /** Hide back-to-editor affordances when rendered as step 4. */
  embedded?: boolean
}

export function BillSummaryContent({ billId, embedded = false }: BillSummaryContentProps) {
  // Move from summary.tsx: useQuery(api.bills.get), calcInputs, totals,
  // finalize/delete mutations + dialogs, participant detail sheet,
  // payment rows, receipt preview — unchanged.
}
```

Keep all hooks inside the component so both consumers get identical behavior. The `embedded` flag only suppresses the "Редактирай" back link (step 4 already lives in the editor) and switches the container class from `page-container-summary` to plain `flex flex-col gap-4`.

- [x] **Step 2: Slim the route**

```tsx
function BillSummary() {
  const params = Route.useParams()
  const billId = params.billId as Id<'bills'>
  const { isAuthenticated, isLoading } = useRequireHostAuth(`/bills/${billId}/summary`)
  if (isLoading || !isAuthenticated) return <SummarySkeleton />
  return (
    <div className="page-container-summary">
      <BillSummaryContent billId={billId} />
    </div>
  )
}
```

- [x] **Step 3: Run preflight to catch import fallout**

Run: `pnpm run preflight`
Expected: PASS; `/summary` renders identically

---

## Task 3: Totals breakdown sheet extraction

**Files:**
- Create: `src/components/bills/totals-breakdown-sheet.tsx`
- Modify: `src/components/bills/sticky-totals-bar.tsx`

- [x] **Step 1: Extract the sheet from `StickyTotalsBar`**

```tsx
export interface TotalsBreakdownSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totals: ReturnType<typeof calculateBillTotals>
  participants: Doc<'participants'>[]
  labels: Record<string, string>
}

export function TotalsBreakdownSheet({ open, onOpenChange, totals, participants, labels }: TotalsBreakdownSheetProps) {
  // Move the <SheetContent side="bottom"> block from sticky-totals-bar.tsx
  // (title „Разбивка на сметката", total row, per-participant rows with status badges)
}
```

- [x] **Step 2: `StickyTotalsBar` consumes it** (temporary — deleted in Task 6)

---

## Task 4: Progress bar + step nav bar

**Files:**
- Create: `src/components/bills/bill-steps-bar.tsx`
- Create: `src/components/bills/step-nav-bar.tsx`

- [x] **Step 1: `BillStepsBar`**

```tsx
const STEP_LABELS = ['Бележка', 'Участници', 'Разпределение', 'Преглед'] as const

export function BillStepsBar({ step, onStepSelect }: { step: BillStep; onStepSelect: (s: BillStep) => void }) {
  return (
    <div className="sticky top-14 z-30 border-b sticky-surface">
      <div className="mx-auto flex max-w-lg flex-col gap-1.5 px-4 py-2">
        <div className="flex gap-1.5">
          {STEP_LABELS.map((label, i) => {
            const s = (i + 1) as BillStep
            return (
              <button
                key={label}
                type="button"
                aria-label={`Стъпка ${s}: ${label}`}
                aria-current={s === step ? 'step' : undefined}
                onClick={() => onStepSelect(s)}
                className={cn(
                  'h-1.5 flex-1 cursor-pointer rounded-full transition-colors',
                  s <= step ? 'bg-primary' : 'bg-border',
                )}
              />
            )
          })}
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          Стъпка {step} · {STEP_LABELS[step - 1]}
        </p>
      </div>
    </div>
  )
}
```

- [x] **Step 2: `StepNavBar`** (steps 1–3 only)

```tsx
export interface StepNavBarProps {
  step: BillStep
  onStepChange: (s: BillStep) => void
  totalCents: number
  unassignedCount: number
  onTotalClick: () => void
}

export function StepNavBar({ step, onStepChange, totalCents, unassignedCount, onTotalClick }: StepNavBarProps) {
  return (
    <>
      <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom,0px))]" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t sticky-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button type="button" onClick={onTotalClick} className="tap-feedback text-left">
            <p className="text-xs text-muted-foreground">Общо</p>
            <p className="money font-semibold">{formatEur(totalCents)}</p>
          </button>
          {step === 3 && unassignedCount > 0 && (
            <Badge className="bg-accent text-accent-foreground">
              {unassignedCount} неразпределени
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            {step > 1 && (
              <Button variant="outline" className="h-11" onClick={() => onStepChange((step - 1) as BillStep)}>
                Назад
              </Button>
            )}
            <Button className="h-11" onClick={() => onStepChange((step + 1) as BillStep)}>
              Напред
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
```

---

## Task 5: Step panels in the editor

**Files:**
- Modify: `src/routes/bills/$billId/index.tsx`

- [x] **Step 1: Group existing cards into panels**

Reorganize the JSX of `BillEditorContent` (no internal component changes):

| Panel | Existing blocks moved in |
|-------|--------------------------|
| `step === 1` | Receipt card (photo/scan CTA) + „Данни за сметката" card (restaurant, tip, `BillAdvancedSettings`) |
| `step === 2` | „Участници" card (`ParticipantList` + `BillInviteCard`) |
| `step === 3` | „Артикули" card (`ItemList`) |
| `step === 4` | `<BillSummaryContent billId={billId} embedded />` |

```tsx
<BillStepsBar step={step} onStepSelect={goToStep} />
<div key={step} className="page-container animate-in fade-in slide-in-from-bottom-2 duration-[250ms]">
  {step === 1 && <>{/* receipt + metadata cards */}</>}
  {step === 2 && <>{/* participants card */}</>}
  {step === 3 && <>{/* items card */}</>}
  {step === 4 && <BillSummaryContent billId={billId} embedded />}
</div>
{step < 4 && !reviewSheetOpen && (
  <StepNavBar
    step={step}
    onStepChange={goToStep}
    totalCents={totals.billTotalCents}
    unassignedCount={unassignedItemsCount}
    onTotalClick={() => setBreakdownOpen(true)}
  />
)}
<TotalsBreakdownSheet open={breakdownOpen} onOpenChange={setBreakdownOpen} ... />
```

`totals` / `unassignedItemsCount` derive from the already-loaded `items`/`assignments`/`participants` via `calculateBillTotals` (same inputs `StickyTotalsBar` used; `tipCents` from `tipCentsForTotals`). Unassigned count: items whose assigned units < quantity.

Receipt scan dialogs/sheets (`ReceiptScanReviewSheet`, pre-scan dialog, replace dialog) stay mounted at root level of the component, outside panels.

- [x] **Step 2: Empty-state guidance (no gating)**

Step 3, when `participants.length === 0`, show above `ItemList`:

```tsx
<Card>
  <CardContent className="flex flex-col items-start gap-2 pt-6">
    <p className="text-sm text-muted-foreground">Няма участници — добавете ги, за да разпределите артикулите.</p>
    <Button variant="outline" className="h-11" onClick={() => goToStep(2)}>Към стъпка 2 · Участници</Button>
  </CardContent>
</Card>
```

- [x] **Step 3: Finalized bills land on step 4**

At the top of `BillEditorContent`:

```tsx
useEffect(() => {
  if (bill.status === 'final' && step !== 4) goToStep(4)
}, [bill.status, step])
```

- [x] **Step 4: Remove `StickyTotalsBar` usage from the editor**

Delete import + `<StickyTotalsBar …/>` block and the old spacer.

---

## Task 6: Cleanup + payment settings hint

**Files:**
- Delete: `src/components/bills/sticky-totals-bar.tsx`
- Modify: `src/styles.css` (remove `.sticky-totals-bar-spacer`)
- Modify: `src/components/bills/bill-summary-content.tsx`

- [x] **Step 1: Delete `StickyTotalsBar`** and its spacer utility; `rg 'StickyTotalsBar|sticky-totals-bar' src/` must return nothing.

- [x] **Step 2: Payment settings hint on step 4**

`BillSummaryContent` already uses `usePaymentSettingsStatus`. Ensure the unconfigured state renders a visible hint card near the payment rows (not only in the header menu):

```tsx
{!paymentSettingsStatus.isConfigured && bill.status !== 'final' && (
  <Card className="border-accent-foreground/40 bg-accent/40">
    <CardContent className="flex flex-col items-start gap-2 pt-6">
      <p className="text-sm">Настройте начин на плащане (Revolut / IBAN), за да могат гостите да плащат лесно.</p>
      <PaymentSettingsOpenButton />
    </CardContent>
  </Card>
)}
```

(Adapt to the actual `usePaymentSettingsStatus` return shape; if an equivalent nudge already exists in the moved summary code, restyle it to this copper card instead of duplicating.)

---

## Task 7: Verification

- [x] **Step 1: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

- [x] **Step 2: Manual QA (full host flow)**

1. Create bill → lands on step 1; scan receipt → items appear; „Напред"
2. Step 2: add participants, QR/share works
3. Step 3: assign items; unassigned chip counts down; breakdown sheet opens from total
4. Step 4: summary matches `/summary` route content; finalize works
5. Deep link `?step=3` + browser back/forward move between steps
6. Finalized bill → editor redirects to step 4; `/summary` route still works standalone
7. Progress segments tappable in both directions; step change animates 250ms slide+fade
8. Guest flow regression: join + claim unaffected

- [x] **Step 3: Update plan status to ✅ Complete**

---

## Self-review (spec coverage)

| Spec requirement (§) | Task |
|------------------|------|
| §4.1 4 steps, same route, `?step` param | Tasks 1, 5 |
| §4.1 summary shared between route and step 4 | Task 2 |
| §4.2 tappable progress bar | Task 4 |
| §4.2 sticky nav: total + Назад/Напред + unassigned chip | Task 4 |
| §4.2 breakdown sheet from total | Tasks 3, 5 |
| §4.3 free navigation, empty-state guidance | Task 5 |
| §4.1 finalized → step 4 | Task 5 |
| §4.4 payment settings hint | Task 6 |
| §3 step transition motion | Task 5 |

**Next after completion:** R4 — `2026-07-09-redesign-r4-cleanup-qa.md`
