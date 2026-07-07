const STORAGE_KEY = 'onova-guest-participant'

export type StoredGuestSession = {
  billId: string
  participantId: string
  sessionToken: string
}

function readSession(): StoredGuestSession | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredGuestSession>
    if (
      typeof parsed.billId === 'string' &&
      typeof parsed.participantId === 'string' &&
      typeof parsed.sessionToken === 'string'
    ) {
      return {
        billId: parsed.billId,
        participantId: parsed.participantId,
        sessionToken: parsed.sessionToken,
      }
    }
    return null
  } catch {
    return null
  }
}

export function createGuestSessionToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getStoredGuestSession(billId: string): StoredGuestSession | null {
  const session = readSession()
  if (!session || session.billId !== billId) return null
  return session
}

/** @deprecated Use getStoredGuestSession */
export function getStoredGuestParticipant(billId: string): string | null {
  return getStoredGuestSession(billId)?.participantId ?? null
}

export function setStoredGuestSession(session: StoredGuestSession): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function setStoredGuestParticipant(
  billId: string,
  participantId: string,
  sessionToken?: string,
): void {
  setStoredGuestSession({
    billId,
    participantId,
    sessionToken: sessionToken ?? createGuestSessionToken(),
  })
}

export function clearStoredGuestParticipant(billId: string): void {
  if (typeof localStorage === 'undefined') return
  const session = readSession()
  if (session?.billId === billId) {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function getConvexErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Неуспешна операция'
}
