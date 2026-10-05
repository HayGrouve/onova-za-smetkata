import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QUICK_BILL_TTL_MS, createQuickBill } from '../../shared/quick-bill.ts'
import {
  QUICK_BILL_STORAGE_KEY,
  editQuickBill,
  readQuickBill,
  subscribeQuickBill,
  updateQuickBill,
  writeQuickBill,
} from './quick-bill-storage.ts'

const NOW = Date.UTC(2026, 9, 5, 19, 30)

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

function stored() {
  return {
    bill: createQuickBill({ now: NOW, seatCount: 3 }),
    scan: { phase: 'read' as const },
  }
}

describe('quick bill storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    vi.stubGlobal('window', new EventTarget())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads back the quick bill it wrote, as the same object until it changes', () => {
    writeQuickBill(stored())
    const first = readQuickBill(NOW)
    expect(first?.bill.seats).toHaveLength(3)
    expect(readQuickBill(NOW)).toBe(first)
  })

  it('forgets a quick bill left untouched for too long', () => {
    writeQuickBill(stored())
    expect(readQuickBill(NOW + QUICK_BILL_TTL_MS + 1)).toBeNull()
  })

  it('keeps a quick bill alive while it is being used', () => {
    writeQuickBill(stored())
    const later = NOW + QUICK_BILL_TTL_MS - 1
    updateQuickBill(
      (current) => ({ ...current, bill: { ...current.bill, tipPercent: 10 } }),
      later,
    )
    expect(readQuickBill(later + QUICK_BILL_TTL_MS - 1)?.bill.tipPercent).toBe(
      10,
    )
  })

  it('tells readers when the quick bill expired under them, and refuses the edit', () => {
    writeQuickBill(stored())
    const listener = vi.fn()
    const unsubscribe = subscribeQuickBill(listener)
    vi.useFakeTimers({ now: NOW + QUICK_BILL_TTL_MS + 1 })
    expect(editQuickBill((bill) => bill).ok).toBe(false)
    expect(listener).toHaveBeenCalled()
    vi.useRealTimers()
    unsubscribe()
  })

  it('ignores what it cannot read', () => {
    localStorage.setItem(QUICK_BILL_STORAGE_KEY, '{"bill":1')
    expect(readQuickBill(NOW)).toBeNull()
    localStorage.setItem(
      QUICK_BILL_STORAGE_KEY,
      JSON.stringify({ ...stored(), scan: { phase: 'reading' } }),
    )
    expect(readQuickBill(NOW)).toBeNull()
  })

  it('tells readers when the quick bill changes or is closed', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeQuickBill(listener)
    writeQuickBill(stored())
    writeQuickBill(null)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(readQuickBill(NOW)).toBeNull()
    unsubscribe()
  })

  it('keeps working in memory when the phone refuses to store it', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    writeQuickBill(stored())
    expect(readQuickBill(NOW)?.bill.seats).toHaveLength(3)
    writeQuickBill(null)
  })
})
