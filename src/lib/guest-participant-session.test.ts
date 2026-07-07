import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearStoredGuestParticipant,
  getStoredGuestParticipant,
  setStoredGuestParticipant,
} from './guest-participant-session.ts'

const STORAGE_KEY = 'onova-guest-participant'

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

describe('guest-participant-session', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    localStorage.clear()
  })

  it('returns null when nothing stored', () => {
    expect(getStoredGuestParticipant('bill_a')).toBeNull()
  })

  it('stores and reads participant for bill', () => {
    setStoredGuestParticipant('bill_a', 'participant_1')
    expect(getStoredGuestParticipant('bill_a')).toBe('participant_1')
  })

  it('clear removes session for matching bill only', () => {
    setStoredGuestParticipant('bill_a', 'participant_1')
    clearStoredGuestParticipant('bill_a')
    expect(getStoredGuestParticipant('bill_a')).toBeNull()
  })

  it('new bill overwrites previous session', () => {
    setStoredGuestParticipant('bill_a', 'participant_1')
    setStoredGuestParticipant('bill_b', 'participant_2')
    expect(getStoredGuestParticipant('bill_a')).toBeNull()
    expect(getStoredGuestParticipant('bill_b')).toBe('participant_2')
  })

  it('ignores malformed json', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(getStoredGuestParticipant('bill_a')).toBeNull()
  })
})
