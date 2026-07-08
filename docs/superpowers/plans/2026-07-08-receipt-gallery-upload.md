# Receipt Gallery Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick a receipt photo from the native camera or gallery via one button on the bill editor.

**Architecture:** Remove the `capture="environment"` attribute from the existing hidden file input in `src/routes/bills/$billId/index.tsx`. All upload, HEIC conversion, storage, and OCR logic stays unchanged.

**Tech Stack:** React (TanStack Router), existing `prepareReceiptImage` + Convex file upload

**Spec:** `docs/superpowers/specs/2026-07-08-receipt-gallery-upload-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/routes/bills/$billId/index.tsx` | Modify | Receipt file input — remove forced camera capture |
| `docs/superpowers/specs/2026-07-07-personal-bill-splitter-design.md` | No change | Already documents camera/gallery intent |

No new files. No backend changes.

---

### Task 1: Remove forced camera capture on receipt input

**Files:**
- Modify: `src/routes/bills/$billId/index.tsx` (~355–362)

- [ ] **Step 1: Update the hidden file input**

Remove the `capture="environment"` line. The input should look like:

```tsx
<input
  ref={fileInputRef}
  type="file"
  accept="image/*,.heic,.heif"
  className="hidden"
  onChange={handleReceiptChange}
/>
```

- [ ] **Step 2: Run lint on the touched file**

Run: `pnpm exec eslint src/routes/bills/\$billId/index.tsx`

Expected: no errors

- [ ] **Step 3: Run unit tests (regression check)**

Run: `pnpm run test`

Expected: all tests pass (upload pipeline unchanged)

---

### Task 2: Manual verification

**Files:** none

- [ ] **Step 1: Verify on a phone (or browser devtools mobile emulation as smoke only)**

1. Open a bill editor on mobile Safari or Chrome
2. Tap “Добави снимка”
3. Confirm the native menu shows **both** camera and gallery/photos options
4. Pick an existing gallery image → preview appears, toast “Снимката е качена”
5. Optionally tap “Разпознай артикули” to confirm OCR still works

- [ ] **Step 2: Desktop smoke**

1. Open bill editor on desktop
2. Click “Добави снимка” → file picker opens
3. Select a JPEG/PNG → upload succeeds

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| One button, native camera + gallery | Task 1 |
| Keep `accept` for images/HEIC | Task 1 |
| Unchanged upload/OCR pipeline | Task 1 (no other edits) |
| Manual mobile + desktop testing | Task 2 |

## Notes

- No automated E2E for native OS picker (Playwright cannot drive iOS/Android file sheets reliably).
- If a platform ever skips gallery without `capture`, fallback would be Task 1b: two hidden inputs — not needed unless manual QA finds a regression.
