/**
 * PROTOTYPE - „what needs you now“ for Direction B. Pure derivations over the
 * mock store: the host's one next thing, and one state word per person.
 */
import { formatEur } from '../mock/store.tsx'
import type { DerivedBill, SeatSummary } from '../mock/store.tsx'
import type { StateTone } from './ui.tsx'

export type HostFocus =
  | { kind: 'empty' }
  | { kind: 'final' }
  | { kind: 'confirm'; seat: SeatSummary; more: number }
  | { kind: 'unclaimed'; units: number; cents: number }
  | { kind: 'invite'; seat: SeatSummary }
  | { kind: 'remind'; seat: SeatSummary }
  | { kind: 'close' }

/** Priority: pending confirmations, unclaimed Units, people to nudge, close. */
export function hostFocus(d: DerivedBill): HostFocus {
  if (d.bill.status === 'final') return { kind: 'final' }
  if (d.totalUnits === 0) return { kind: 'empty' }
  const pending = d.guests.filter((g) => g.pendingCents > 0)
  if (pending.length > 0) {
    return { kind: 'confirm', seat: pending[0], more: pending.length - 1 }
  }
  if (d.unclaimedUnits > 0) {
    return {
      kind: 'unclaimed',
      units: d.unclaimedUnits,
      cents: d.unclaimedCents,
    }
  }
  const notHere = d.guests.find((g) => !g.joined && g.remainingCents > 0)
  if (notHere) return { kind: 'invite', seat: notHere }
  const owing = d.guests
    .filter((g) => g.remainingCents > 0)
    .sort((a, b) => b.remainingCents - a.remainingCents)
  if (owing.length > 0) return { kind: 'remind', seat: owing[0] }
  return { kind: 'close' }
}

export function personState(
  d: DerivedBill,
  s: SeatSummary,
): { tone: StateTone; word: string } {
  if (s.isHost) return { tone: 'host', word: 'Вие' }
  const final = d.bill.status === 'final'
  if (s.pendingCents > 0) return { tone: 'pending', word: 'Чака потвърждение' }
  if (s.totals.owedCents > 0 && s.remainingCents === 0) {
    return { tone: 'paid', word: 'Платено' }
  }
  if (final) return { tone: 'owes', word: 'Остатък' }
  if (!s.joined) return { tone: 'idle', word: 'Още не е тук' }
  if (d.unclaimedUnits > 0 || s.totals.owedCents === 0) {
    return { tone: 'choosing', word: 'Избира' }
  }
  return { tone: 'owes', word: 'Дължи' }
}

export function billLink(d: DerivedBill) {
  return `onova-za-smetkata.com/s/${d.bill._id.replace(/^b-/, '')}`
}

export function reminderText(d: DerivedBill, s: SeatSummary) {
  const place = d.bill.restaurantName || 'вечерята'
  if (!s.joined) {
    return `Здрасти, ${s.name}! Ето сметката от ${place}. Избери своето и плати оттук: https://${billLink(d)}`
  }
  return `Здрасти, ${s.name}! За ${place} се падат ${formatEur(s.remainingCents)}. Плащането е оттук: https://${billLink(d)}`
}
