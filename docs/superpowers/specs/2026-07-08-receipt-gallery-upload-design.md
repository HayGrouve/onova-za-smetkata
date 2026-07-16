# Receipt Gallery Upload — Design Spec

**Date:** 2026-07-08  
**Status:** Approved  
**Project:** onova-za-smetkata

## Summary

Allow hosts to attach a receipt photo from **either the device camera or the photo gallery** using a single “Добави снимка” button on the bill editor. Today, `capture="environment"` on the hidden file input forces the rear camera on mobile and prevents choosing an existing image.

## Problem

On mobile, tapping “Добави снимка” opens the camera immediately. Users cannot pick a photo they already took or received (e.g. screenshot, WhatsApp image, gallery photo).

The original product design (`2026-07-07-personal-bill-splitter-design.md`) specified “receipt photo (camera/gallery)” — implementation diverged due to the `capture` attribute.

## Goal

Two explicit actions: pick an existing image from the gallery, or take a new photo with the camera — no ambiguity on mobile.

## Non-goals

- PDF or document upload
- In-app camera preview or custom capture UI
- Image cropping or rotation before upload
- Changes to OCR, storage, or backend APIs

## Solution

Two side-by-side buttons on the bill editor, each wired to its own hidden file input:

| Button           | Input                                         | Behavior                                |
| ---------------- | --------------------------------------------- | --------------------------------------- |
| **От галерията** | `accept="image/*,.heic,.heif"` (no `capture`) | Native gallery / file picker            |
| **Снимай**       | same `accept` + `capture="environment"`       | Opens rear camera immediately on mobile |

Shared `handleReceiptChange` → `prepareReceiptImage` → Convex upload → `receiptStorageId`.

### Expected platform behavior

| Platform       | Behavior after change                                    |
| -------------- | -------------------------------------------------------- |
| iOS Safari     | Action sheet: Take Photo, Photo Library, Browse          |
| Android Chrome | Picker with Camera and Gallery/Files options             |
| Desktop        | Standard file dialog (select image file; no live camera) |

### UI copy

No copy changes required. Button labels remain “Добави снимка” / “Смени снимката” / “Качване...”.

Optional future polish (out of scope): rename label to “Добави снимка или файл” — not needed for v1.

## Architecture

No architectural changes. Single attribute removal on existing client component:

```
src/routes/bills/$billId/index.tsx
  └── hidden <input type="file">  (remove capture)
  └── handleReceiptChange         (unchanged)
  └── prepareReceiptImage         (unchanged)
  └── Convex files + receiptScan  (unchanged)
```

## Error handling

Unchanged. Gallery picks use the same validation and HEIC conversion path as camera captures.

## Testing

### Manual (required before release)

- [ ] iPhone Safari: tap button → choose Photo Library → upload succeeds, preview shows
- [ ] iPhone Safari: tap button → Take Photo → upload succeeds
- [ ] Android Chrome: gallery and camera both work
- [ ] HEIC from gallery uploads and OCR still runs
- [ ] Desktop: file picker selects JPEG/PNG

### Automated

- No new unit tests required (behavior is browser-native; pipeline already tested)
- Optional: comment in code or E2E README noting native picker is not automatable in Playwright

## Rollback

Re-add `capture="environment"` if a platform regression appears (unlikely).

## Success criteria

1. Mobile users see native camera **and** gallery options from one button
2. Existing upload, preview, and OCR flows work for gallery-selected images
3. No backend or schema changes
