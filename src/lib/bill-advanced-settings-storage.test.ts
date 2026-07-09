import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BILL_ADVANCED_SETTINGS_OPEN_KEY,
  readBillAdvancedSettingsOpen,
  writeBillAdvancedSettingsOpen,
} from './bill-advanced-settings-storage'

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

describe('bill-advanced-settings-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to collapsed when unset', () => {
    expect(readBillAdvancedSettingsOpen()).toBe(false)
  })

  it('persists open state', () => {
    writeBillAdvancedSettingsOpen(true)
    expect(readBillAdvancedSettingsOpen()).toBe(true)
    expect(localStorage.getItem(BILL_ADVANCED_SETTINGS_OPEN_KEY)).toBe('1')
  })

  it('persists closed state', () => {
    writeBillAdvancedSettingsOpen(true)
    writeBillAdvancedSettingsOpen(false)
    expect(readBillAdvancedSettingsOpen()).toBe(false)
  })
})
