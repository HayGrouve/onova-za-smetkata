export function sortFriendGroupsWithPinned<T extends { _id: string }>(
  groups: T[],
  pinnedId: string | null,
): { groups: T[]; pinnedId: string | null } {
  if (!pinnedId) return { groups, pinnedId: null }
  const index = groups.findIndex((group) => group._id === pinnedId)
  if (index < 0) return { groups, pinnedId: null }
  if (index === 0) return { groups, pinnedId }
  const next = [...groups]
  const [pinned] = next.splice(index, 1)
  next.unshift(pinned)
  return { groups: next, pinnedId }
}
