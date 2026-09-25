import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissClaimHint, isClaimHintDismissed } from './claim-hint-storage'

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

describe('claim-hint-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the hint until it is dismissed', () => {
    expect(isClaimHintDismissed()).toBe(false)
    dismissClaimHint()
    expect(isClaimHintDismissed()).toBe(true)
  })
})
