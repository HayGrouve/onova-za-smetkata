export const LAST_FRIEND_GROUP_KEY = 'last-used-friend-group-id'

export function readLastFriendGroupId(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(LAST_FRIEND_GROUP_KEY)
}

export function writeLastFriendGroupId(groupId: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LAST_FRIEND_GROUP_KEY, groupId)
}
