const STORAGE_KEY = 'onova-guest-participant'

type StoredGuestSession = {
  billId: string
  participantId: string
}

function readSession(): StoredGuestSession | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredGuestSession
    if (
      typeof parsed.billId === 'string' &&
      typeof parsed.participantId === 'string'
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function getStoredGuestParticipant(billId: string): string | null {
  const session = readSession()
  if (!session || session.billId !== billId) return null
  return session.participantId
}

export function setStoredGuestParticipant(
  billId: string,
  participantId: string,
): void {
  if (typeof localStorage === 'undefined') return
  const payload: StoredGuestSession = { billId, participantId }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearStoredGuestParticipant(billId: string): void {
  if (typeof localStorage === 'undefined') return
  const session = readSession()
  if (session?.billId === billId) {
    localStorage.removeItem(STORAGE_KEY)
  }
}
