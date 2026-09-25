const CLAIM_HINT_DISMISSED_KEY = 'onova-claim-hint-dismissed'

export function isClaimHintDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(CLAIM_HINT_DISMISSED_KEY) === '1'
}

export function dismissClaimHint(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(CLAIM_HINT_DISMISSED_KEY, '1')
}
