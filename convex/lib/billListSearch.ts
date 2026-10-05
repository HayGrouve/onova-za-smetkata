/**
 * Bills one search page may scan. A Host with more bills than this keeps
 * searching by loading the next page; the page just comes back short.
 */
export const HOME_BILL_SEARCH_MAX_ROWS_READ = 1000

export function normalizeHomeBillSearch(search: string | undefined): string {
  return (search ?? '').trim().toLowerCase()
}

export function billMatchesHomeSearch(
  bill: { restaurantName: string; listParticipantNames?: string[] },
  normalizedSearch: string,
): boolean {
  if (!normalizedSearch) return true
  if (bill.restaurantName.toLowerCase().includes(normalizedSearch)) return true
  return (bill.listParticipantNames ?? []).some((name) =>
    name.toLowerCase().includes(normalizedSearch),
  )
}
