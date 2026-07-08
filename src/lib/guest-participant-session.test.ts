import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearStoredGuestParticipant,
  createGuestSessionToken,
  getOrCreateGuestDeviceId,
  getStoredGuestSession,
  getStoredGuestParticipant,
  setStoredGuestSession,
  setStoredGuestParticipant,
} from './guest-participant-session.ts'

const STORAGE_KEY = 'onova-guest-participant'
const DEVICE_KEY = 'onova-guest-device'

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
    vi.stubGlobal('sessionStorage', createStorage())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('returns null when nothing stored', () => {
    expect(getStoredGuestSession('bill_a')).toBeNull()
    expect(getStoredGuestParticipant('bill_a')).toBeNull()
  })

  it('stores and reads session for bill', () => {
    setStoredGuestSession({
      billId: 'bill_a',
      participantId: 'participant_1',
      sessionToken: 'token-1',
      shareToken: 'share-1',
    })
    expect(getStoredGuestSession('bill_a')).toEqual({
      billId: 'bill_a',
      participantId: 'participant_1',
      sessionToken: 'token-1',
      shareToken: 'share-1',
    })
    expect(getStoredGuestParticipant('bill_a')).toBe('participant_1')
  })

  it('setStoredGuestParticipant creates a session token', () => {
    setStoredGuestParticipant('bill_a', 'participant_1', 'share-1', 'token-abc')
    expect(getStoredGuestSession('bill_a')?.sessionToken).toBe('token-abc')
    expect(getStoredGuestSession('bill_a')?.shareToken).toBe('share-1')
  })

  it('createGuestSessionToken returns non-empty string', () => {
    expect(createGuestSessionToken().length).toBeGreaterThan(0)
  })

  it('getOrCreateGuestDeviceId persists in sessionStorage', () => {
    const first = getOrCreateGuestDeviceId()
    const second = getOrCreateGuestDeviceId()
    expect(first).toBe(second)
    expect(sessionStorage.getItem(DEVICE_KEY)).toBe(first)
  })

  it('clear removes session for matching bill only', () => {
    setStoredGuestSession({
      billId: 'bill_a',
      participantId: 'participant_1',
      sessionToken: 'token-1',
      shareToken: 'share-1',
    })
    clearStoredGuestParticipant('bill_a')
    expect(getStoredGuestSession('bill_a')).toBeNull()
  })

  it('new bill overwrites previous session', () => {
    setStoredGuestSession({
      billId: 'bill_a',
      participantId: 'participant_1',
      sessionToken: 'token-1',
      shareToken: 'share-1',
    })
    setStoredGuestSession({
      billId: 'bill_b',
      participantId: 'participant_2',
      sessionToken: 'token-2',
      shareToken: 'share-2',
    })
    expect(getStoredGuestSession('bill_a')).toBeNull()
    expect(getStoredGuestSession('bill_b')?.participantId).toBe('participant_2')
  })

  it('ignores malformed json', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(getStoredGuestSession('bill_a')).toBeNull()
  })

  it('ignores session without shareToken', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        billId: 'bill_a',
        participantId: 'participant_1',
        sessionToken: 'token-1',
      }),
    )
    expect(getStoredGuestSession('bill_a')).toBeNull()
  })
})
