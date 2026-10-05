import type { SeatStore, StoredGuestSession } from './guest-flow-session.ts'

const STORAGE_KEY = 'onova-guest-participant'
const DEVICE_KEY = 'onova-guest-device'

function canUseLocalStorage(): boolean {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      typeof localStorage.getItem === 'function'
    )
  } catch {
    return false
  }
}

function canUseSessionStorage(): boolean {
  try {
    return (
      typeof sessionStorage !== 'undefined' &&
      typeof sessionStorage.getItem === 'function'
    )
  } catch {
    return false
  }
}

function readSession(): StoredGuestSession | null {
  if (!canUseLocalStorage()) return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredGuestSession>
    if (
      typeof parsed.billId === 'string' &&
      typeof parsed.participantId === 'string' &&
      typeof parsed.sessionToken === 'string' &&
      typeof parsed.shareToken === 'string' &&
      parsed.shareToken.length > 0
    ) {
      const covered = Array.isArray(parsed.coveredParticipantIds)
        ? parsed.coveredParticipantIds.filter(
            (id): id is string => typeof id === 'string',
          )
        : []
      return {
        billId: parsed.billId,
        participantId: parsed.participantId,
        sessionToken: parsed.sessionToken,
        shareToken: parsed.shareToken,
        ...(covered.length > 0 ? { coveredParticipantIds: covered } : {}),
      }
    }
    return null
  } catch {
    return null
  }
}

export function createGuestSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getOrCreateGuestDeviceId(): string {
  if (!canUseSessionStorage()) return ''
  const existing = sessionStorage.getItem(DEVICE_KEY)
  if (existing) return existing
  const id = createGuestSessionToken()
  sessionStorage.setItem(DEVICE_KEY, id)
  return id
}

function getStoredGuestSession(billId: string): StoredGuestSession | null {
  const session = readSession()
  if (!session || session.billId !== billId) return null
  return session
}

function setStoredGuestSession(session: StoredGuestSession): void {
  if (!canUseLocalStorage()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function clearStoredGuestParticipant(billId: string): void {
  if (!canUseLocalStorage()) return
  const session = readSession()
  if (session?.billId === billId) {
    localStorage.removeItem(STORAGE_KEY)
  }
}

/** One Guest session per browser, kept in localStorage across visits. */
export const localSeatStore: SeatStore = {
  read: getStoredGuestSession,
  write: setStoredGuestSession,
  clear: clearStoredGuestParticipant,
}
