import { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages.ts'

function withoutFinalPeriod(text: string): string {
  return text.trim().replace(/\.$/, '')
}

// Host and Guest queries word „not found“ with and without the final period.
const DEFINITE_REASONS = new Set<string>(
  [GUEST_FLOW_MESSAGES.invalidShareLink, GUEST_FLOW_MESSAGES.billNotFound].map(
    withoutFinalPeriod,
  ),
)

/**
 * An invalid link or a bill that is gone does not come back on retry, so the
 * error view offers the way home instead of „Опитай отново“.
 */
export function isDefiniteErrorReason(reason: string | null): boolean {
  return reason !== null && DEFINITE_REASONS.has(withoutFinalPeriod(reason))
}
