/** Session expires if no heartbeat within this window. */
export const GUEST_SESSION_TTL_MS = 90_000

export function isGuestSessionActive(
  lastSeenAt: number,
  now = Date.now(),
): boolean {
  return now - lastSeenAt < GUEST_SESSION_TTL_MS
}
