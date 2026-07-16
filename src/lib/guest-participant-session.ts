const STORAGE_KEY = 'onova-guest-participant'
const DEVICE_KEY = 'onova-guest-device'

export type StoredGuestSession = {
  billId: string
  participantId: string
  sessionToken: string
  shareToken: string
}

function canUseLocalStorage(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
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
      typeof window !== 'undefined' &&
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
      return {
        billId: parsed.billId,
        participantId: parsed.participantId,
        sessionToken: parsed.sessionToken,
        shareToken: parsed.shareToken,
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

export function getStoredGuestSession(
  billId: string,
): StoredGuestSession | null {
  const session = readSession()
  if (!session || session.billId !== billId) return null
  return session
}

/** @deprecated Use getStoredGuestSession */
export function getStoredGuestParticipant(billId: string): string | null {
  return getStoredGuestSession(billId)?.participantId ?? null
}

export function setStoredGuestSession(session: StoredGuestSession): void {
  if (!canUseLocalStorage()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function setStoredGuestParticipant(
  billId: string,
  participantId: string,
  shareToken: string,
  sessionToken?: string,
): void {
  setStoredGuestSession({
    billId,
    participantId,
    shareToken,
    sessionToken: sessionToken ?? createGuestSessionToken(),
  })
}

export function clearStoredGuestParticipant(billId: string): void {
  if (!canUseLocalStorage()) return
  const session = readSession()
  if (session?.billId === billId) {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function getConvexErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Неуспешна операция'
}
