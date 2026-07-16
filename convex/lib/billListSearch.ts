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
