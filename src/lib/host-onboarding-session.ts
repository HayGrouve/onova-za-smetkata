import type { HostOnboardingContentRoute } from '../../shared/host-onboarding'

const WELCOME_DEFERRED_KEY = 'host-onboarding:welcome-deferred'
const REPLAY_KEY = 'host-onboarding:replay'
const DISMISSED_HINTS_PREFIX = 'host-onboarding:dismissed:'
const CONTENT_ROUTE_PREFIX = 'host-onboarding:route:'
const CONTENT_ROUTE_CHOICE_SEEN_PREFIX =
  'host-onboarding:content-route-choice-pop-v2:'
const HANDOFF_DISMISSED_PREFIX = 'host-onboarding:handoff:'

function readSessionFlag(key: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  return sessionStorage.getItem(key) === '1'
}

function writeSessionFlag(key: string, value: boolean) {
  if (typeof sessionStorage === 'undefined') return
  if (value) {
    sessionStorage.setItem(key, '1')
  } else {
    sessionStorage.removeItem(key)
  }
}

export function isWelcomeDeferredThisSession(): boolean {
  return readSessionFlag(WELCOME_DEFERRED_KEY)
}

export function deferWelcomeThisSession() {
  writeSessionFlag(WELCOME_DEFERRED_KEY, true)
}

export function isReplayActiveThisSession(): boolean {
  return readSessionFlag(REPLAY_KEY)
}

export function startReplayThisSession() {
  writeSessionFlag(REPLAY_KEY, true)
}

export function stopReplayThisSession() {
  writeSessionFlag(REPLAY_KEY, false)
}

function dismissedHintsKey(billId: string) {
  return `${DISMISSED_HINTS_PREFIX}${billId}`
}

export function readDismissedHintIds(billId: string): string[] {
  if (typeof sessionStorage === 'undefined') return []
  const raw = sessionStorage.getItem(dismissedHintsKey(billId))
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

export function dismissHintThisSession(billId: string, hintId: string) {
  if (typeof sessionStorage === 'undefined') return
  const current = readDismissedHintIds(billId)
  if (current.includes(hintId)) return
  sessionStorage.setItem(
    dismissedHintsKey(billId),
    JSON.stringify([...current, hintId]),
  )
}

function contentRouteKey(billId: string) {
  return `${CONTENT_ROUTE_PREFIX}${billId}`
}

export function readContentRoute(
  billId: string,
): HostOnboardingContentRoute | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  const value = sessionStorage.getItem(contentRouteKey(billId))
  if (value === 'scan' || value === 'manual') return value
  return undefined
}

export function saveContentRoute(
  billId: string,
  route: HostOnboardingContentRoute,
) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(contentRouteKey(billId), route)
}

export function hasSeenContentRouteChoice(billId: string): boolean {
  return readSessionFlag(`${CONTENT_ROUTE_CHOICE_SEEN_PREFIX}${billId}`)
}

export function markContentRouteChoiceSeen(billId: string) {
  writeSessionFlag(`${CONTENT_ROUTE_CHOICE_SEEN_PREFIX}${billId}`, true)
}

export function isHandoffDismissedThisSession(billId: string): boolean {
  return readSessionFlag(`${HANDOFF_DISMISSED_PREFIX}${billId}`)
}

export function dismissHandoffThisSession(billId: string) {
  writeSessionFlag(`${HANDOFF_DISMISSED_PREFIX}${billId}`, true)
}

/** Clears session-local onboarding flags (welcome defer, replay, hints, routes). */
export function clearHostOnboardingSession() {
  if (typeof sessionStorage === 'undefined') return
  const keysToRemove: string[] = []
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index)
    if (!key) continue
    if (
      key === WELCOME_DEFERRED_KEY ||
      key === REPLAY_KEY ||
      key.startsWith(DISMISSED_HINTS_PREFIX) ||
      key.startsWith(CONTENT_ROUTE_PREFIX) ||
      key.startsWith(CONTENT_ROUTE_CHOICE_SEEN_PREFIX) ||
      key.startsWith(HANDOFF_DISMISSED_PREFIX)
    ) {
      keysToRemove.push(key)
    }
  }
  for (const key of keysToRemove) {
    sessionStorage.removeItem(key)
  }
}
