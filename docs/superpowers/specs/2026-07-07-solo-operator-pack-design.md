# Solo Operator Pack — Design Spec

**Date:** 2026-07-07  
**Project:** onova-za-smetkata  
**Status:** Approved  
**Builds on:** `docs/superpowers/specs/2026-07-07-personal-bill-splitter-design.md`

## Summary

Enhance the personal bill-splitter for a single operator who runs the bill while friends settle outside the app. Adds share/copy summary, Revolut-friendly payment prompts, payment progress on summary, quick-add recent participant names, and small UX guardrails.

## Decisions

| Decision | Choice |
|----------|--------|
| Product direction | Solo operator — friends do not need the app |
| Saved names | Derived recent names from past bills (no new contacts table) |
| Payment handle storage | `localStorage` (Revolut username, optional IBAN) |
| Share mechanism | Plain-text summary; Web Share API with clipboard fallback |
| Progress metric | Count participants fully paid (`status === 'paid'`) |
| Restaurant name | Required before finalize (client + server) |

## Architecture

```
[Summary Page]
  ├─ PaymentProgressBar (paid count / total)
  ├─ ShareBillButton → formatBillShareText() → share or clipboard
  ├─ PaymentRow (+ copy, Revolut actions)
  └─ ParticipantDetailSheet (+ same pay actions)

[Editor]
  └─ RecentParticipantChips → participants.listRecentNames → participants.add

[Home or Summary]
  └─ PaymentSettingsSheet → localStorage read/write

[Convex]
  ├─ participants.listRecentNames (query)
  └─ bills.finalize (server validation: restaurantName non-empty)

[Pure TS]
  ├─ formatBillShareText()
  ├─ formatCopyAmount()
  └─ validateBillForFinalize (+ empty restaurantName)
```

No auth. No public share URLs. No schema changes beyond optional query logic.

## Feature 1: Share bill summary

### Trigger

Button **„Сподели сметка“** on summary page, placed after the total card (before receipt preview).

### Text format

Bulgarian plain text, one block:

```
Сметка: {restaurantName}, {formattedDate}
Общо: {billTotal}

{participantLabel}: {owed} — {statusLabel}
...
```

- `statusLabel`: неплатено / частично / платено (from `ParticipantTotals.status`)
- Use existing `buildParticipantLabels` and `formatEur`
- Participants sorted by `sortOrder`

### Behavior

1. Build text via `formatBillShareText()` in `src/lib/bill-share.ts`
2. If `navigator.share` available → `navigator.share({ title, text })`
3. Else → `navigator.clipboard.writeText(text)` + toast „Копирано“
4. On share cancel (AbortError) → silent, no error toast

### Errors

Clipboard failure → toast error „Неуспешно копиране“

## Feature 2: Copy amount on tap

### Targets

- Summary `PaymentRow`: tap **Остатък** (remaining balance) copies that amount
- Participant detail sheet: same on **Остатък** cell

### Format

`formatCopyAmount(cents)` → `"12,50"` (decimal comma, no currency symbol) for easy paste into banking apps. Optional second format with ` EUR` suffix in share text only.

### UX

- Tappable cells get `cursor-pointer tap-feedback` + `aria-label="Копирай сумата"`
- Toast: „Сумата е копирана“

Do not copy on tap of **Дължи** or **Платено** — only remaining balance.

## Feature 3: Revolut-friendly pay prompts

### Settings (localStorage)

Key: `onova-payment-settings`

```typescript
interface PaymentSettings {
  revolutUsername?: string  // without @ or revolut.me prefix
  iban?: string             // optional, copy-only
}
```

### Settings UI

Sheet **„Настройки за плащане“** accessible from:
- Home page: text button or icon in header area (below title row)
- Summary page: link near share button

Fields:
- Revolut потребителско име (placeholder: `username`)
- IBAN (optional, placeholder for manual transfers)

Save on blur or explicit „Запази“ button. Persist to localStorage.

### Per-participant actions

On `PaymentRow` and `ParticipantDetailSheet` when `remainingCents > 0`:

| Action | Behavior |
|--------|----------|
| **Копирай** | Copy remaining amount (same as tap on остатък) |
| **Revolut** | Visible only if `revolutUsername` set. Opens `https://revolut.me/{username}/{amountInEur}` in new tab/window where amount is decimal EUR string (e.g. `12.50`). Also copy amount to clipboard first. Toast: „Отворен Revolut“ |
| **IBAN** | Visible only if IBAN set. Copy IBAN to clipboard. Toast: „IBAN копиран“ |

Revolut URL amount: use `(remainingCents / 100).toFixed(2)` with dot separator per Revolut URL convention.

Mobile: `window.open` or `location.href` for Revolut link.

## Feature 4: Payment progress

### Placement

Card or compact row above **Плащания** on summary.

### Display

- Text: **„{paidCount} от {totalCount} платени“**
- Thin horizontal progress bar (`paidCount / totalCount`)
- If `totalCount === 0`, hide progress section

### Definition

`paidCount` = participants where `totals.byParticipant[id].status === 'paid'`

Partial payers count as not paid for progress.

### Optional sort

Payment list sorted: unpaid → partial → paid (within each group, preserve `sortOrder`).

## Feature 5: Recent participant quick-add

### Backend

New query `participants.listRecentNames`:

- Scan all `participants` (or join bills ordered by `updatedAt`)
- Return distinct `name` strings, most recently used first
- Dedupe case-insensitively; keep most recent casing
- Limit 12 names

Implementation: collect participants from bills sorted by `updatedAt` desc, build ordered unique set.

### Frontend

In `ParticipantList` on editor:

- Query `listRecentNames`
- Filter out names already on current bill (case-insensitive)
- Render horizontal scroll row of chip buttons above add input
- Tap chip → `participants.add({ billId, name })`

Empty state: hide chip row when no suggestions.

## Feature 6: Small UX fixes

### Restaurant name required

**Client:** Add validation error in `validateBillForFinalize`:

```typescript
if (!restaurantName.trim()) {
  errors.push({ code: 'missing_restaurant', message: 'Въведете име на ресторант.' })
}
```

Pass `restaurantName` into validation input from summary/editor.

**Server:** `bills.finalize` loads bill, throws if `restaurantName.trim()` empty.

### Delete bill from home

On `BillCard`: overflow menu (⋮) or long-press alternative → **Изтрий** opens same confirm dialog as summary delete → `bills.remove` → navigate stays on home.

Use Shadcn DropdownMenu on card (stop propagation on link navigation).

### Hide devtools in production

In `__root.tsx`, render `TanStackDevtools` only when `import.meta.env.DEV`.

## Components & files

| File | Action |
|------|--------|
| `src/lib/bill-share.ts` | New: share text + copy amount formatters |
| `src/lib/bill-share.test.ts` | Unit tests |
| `src/lib/payment-settings.ts` | New: localStorage read/write |
| `src/lib/bill-calculations.ts` | Extend validation |
| `convex/participants.ts` | Add `listRecentNames` query |
| `convex/bills.ts` | Server finalize guard |
| `src/components/bills/share-bill-button.tsx` | New |
| `src/components/bills/payment-progress.tsx` | New |
| `src/components/bills/payment-settings-sheet.tsx` | New |
| `src/components/bills/participant-pay-actions.tsx` | New (copy/revolut/iban) |
| `src/components/bills/payment-row.tsx` | Wire pay actions + copy |
| `src/components/bills/participant-detail-sheet.tsx` | Wire pay actions |
| `src/components/bills/participant-list.tsx` | Recent chips |
| `src/components/bills/bill-card.tsx` | Delete menu |
| `src/routes/bills/$billId/summary.tsx` | Progress, share, settings link, sort |
| `src/routes/index.tsx` | Settings entry |
| `src/routes/__root.tsx` | DEV-only devtools |

## Out of scope

- PDF/image export
- Public read-only bill URLs
- Auth or multi-user
- Payment notes UI
- Proportional tax
- Convex-backed settings sync
- Push notifications / reminders

## Testing

| Area | Test |
|------|------|
| `formatBillShareText` | Restaurant, totals, statuses in output |
| `formatCopyAmount` | 1250 → `12,50` |
| `validateBillForFinalize` | Empty restaurantName → error |
| Manual | Share on mobile, Revolut link, recent chips, delete from home, finalize blocked without restaurant |

## Error handling

- Share/clipboard failures → user-facing toast, no crash
- Invalid Revolut username (empty after trim) → hide Revolut button
- `listRecentNames` empty → hide chip row
- Finalize server rejection → toast with Bulgarian message
