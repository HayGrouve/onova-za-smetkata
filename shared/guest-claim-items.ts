export interface GuestItemAssignment {
  itemId: string
  participantId: string
  unitIndex: number
}

export function filterGuestClaimItemsBySearch<
  T extends Pick<{ name: string }, 'name'>,
>(items: T[], search: string): T[] {
  const query = search.trim().toLocaleLowerCase('bg')
  if (!query) return items
  return items.filter((item) =>
    item.name.toLocaleLowerCase('bg').includes(query),
  )
}
