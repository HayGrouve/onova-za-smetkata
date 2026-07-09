# Bill Advanced Settings Collapsible (Scoped Design)

**Date:** 2026-07-09  
**Status:** Implemented  
**Scope:** Bill editor — hide note and date behind collapsible section

---

## Summary

Collapsible **„Разширени настройки“** after Ресторант hides **Бележка** and **Дата**. Default collapsed; open/closed state persisted in `localStorage` (`bill-advanced-settings-open`).

## Files

- `src/lib/bill-advanced-settings-storage.ts` — read/write preference
- `src/components/bills/bill-advanced-settings.tsx` — collapsible UI
- `src/components/ui/collapsible.tsx` — shadcn Collapsible
- `src/routes/bills/$billId/index.tsx` — integration
