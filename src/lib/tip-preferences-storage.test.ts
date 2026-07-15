import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TIP_PREFERENCE_KEY,
  readTipPreference,
  writeTipPreference,
} from './tip-preferences-storage'

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

describe('tip-preferences-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when unset', () => {
    expect(readTipPreference()).toBeNull()
  })

  it('persists percent preference', () => {
    writeTipPreference({ mode: 'percent', percent: 15 })
    expect(readTipPreference()).toEqual({ mode: 'percent', percent: 15 })
    expect(localStorage.getItem(TIP_PREFERENCE_KEY)).toBe(
      JSON.stringify({ mode: 'percent', percent: 15 }),
    )
  })

  it('persists custom preference', () => {
    writeTipPreference({ mode: 'custom', customCents: 350 })
    expect(readTipPreference()).toEqual({ mode: 'custom', customCents: 350 })
  })

  it('returns null for invalid JSON', () => {
    localStorage.setItem(TIP_PREFERENCE_KEY, '{bad')
    expect(readTipPreference()).toBeNull()
  })

  it('returns null for unknown shape', () => {
    localStorage.setItem(TIP_PREFERENCE_KEY, JSON.stringify({ mode: 'nope' }))
    expect(readTipPreference()).toBeNull()
  })
})
