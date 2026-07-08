# Receipt Storage Cleanup — Design Spec

**Date:** 2026-07-07  
**Project:** onova-za-smetkata  
**Status:** Approved

## Summary

Automatically delete Convex file storage for receipt images when a bill is deleted or when its receipt photo is replaced with a new upload. Also delete related `receiptScans` records so scan history does not reference removed files.

## Decisions

| Decision          | Choice                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Bill deleted      | Delete `receiptScans` for bill, then delete `bills.receiptStorageId` from storage         |
| Receipt replaced  | Patch bill with new ID first, delete all `receiptScans` for bill, delete old storage file |
| Dismiss scan only | No storage delete (bill still uses image)                                                 |
| Implementation    | Shared helper in `convex/lib/receiptStorage.ts`                                           |
| Orphan sweeper    | Out of scope                                                                              |

## Delete order

**Replace:** patch bill → delete `receiptScans` for bill → `ctx.storage.delete(oldId)`

**Bill remove:** delete `receiptScans` → cascade delete participants/items/payments → delete bill → `ctx.storage.delete(receiptStorageId)` if set

## Components

### `convex/lib/receiptStorage.ts`

- `deleteReceiptScansForBill(ctx, billId)` — query `receiptScans` by bill, delete each row
- `deleteReceiptStorageFile(ctx, storageId)` — call `ctx.storage.delete`
- Used from `bills.update` and `bills.remove`

### `convex/bills.ts`

- **`update`:** load bill; if new `receiptStorageId` differs from current, patch then cleanup old file + scans
- **`remove`:** load bill; cleanup scans + storage before/after existing cascade

## Error handling

- Bill not found on update/remove: throw (update should verify bill exists)
- Storage delete is best-effort after DB is consistent; Convex `storage.delete` on missing files is treated as success

## Testing

- Manual: upload receipt → replace photo → old storage ID gone in Convex dashboard
- Manual: delete bill with receipt → storage + `receiptScans` rows removed

## Out of scope

- Removing receipt without replacement (no UI)
- Background orphan cleanup job
- Deleting storage on `dismissScan` only
