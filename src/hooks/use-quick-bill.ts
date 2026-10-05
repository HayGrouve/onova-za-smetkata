import { useSyncExternalStore } from 'react'
import { readQuickBill, subscribeQuickBill } from '#/lib/quick-bill-storage.ts'
import type { StoredQuickBill } from '#/lib/quick-bill-storage.ts'

/** The quick bill on this phone, live across pages and tabs. */
export function useQuickBill(): StoredQuickBill | null {
  return useSyncExternalStore(
    subscribeQuickBill,
    () => readQuickBill(),
    () => null,
  )
}
