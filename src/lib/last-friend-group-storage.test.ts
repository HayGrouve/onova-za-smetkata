import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LAST_FRIEND_GROUP_KEY,
  readLastFriendGroupId,
  writeLastFriendGroupId,
} from './last-friend-group-storage'

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

describe('last-friend-group-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when unset', () => {
    expect(readLastFriendGroupId()).toBeNull()
  })

  it('persists group id', () => {
    writeLastFriendGroupId('groups_abc')
    expect(readLastFriendGroupId()).toBe('groups_abc')
    expect(localStorage.getItem(LAST_FRIEND_GROUP_KEY)).toBe('groups_abc')
  })
})
