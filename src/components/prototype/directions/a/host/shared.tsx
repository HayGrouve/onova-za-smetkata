/** PROTOTYPE — Direction A host helpers: status labels and seat payment state. */
import type { SeatSummary } from '../../mock/store.tsx'
import type { PillTone } from '../ui.tsx'

export type BillStatus = 'draft' | 'collecting' | 'final'

export function statusPill(status: BillStatus): {
  tone: PillTone
  label: string
} {
  if (status === 'final') return { tone: 'neutral', label: 'Приключена' }
  if (status === 'collecting') return { tone: 'accent', label: 'Събиране' }
  return { tone: 'neutral', label: 'Чернова' }
}

export function billLink(id: string) {
  return `onova.bg/s/${id === 'live' || id === 'b-chuchura' ? 'chuchura-7k2' : id.replace('b-', '')}`
}

export type SeatPay = 'paid' | 'pending' | 'due' | 'idle' | 'none'

export function seatPayState(seat: SeatSummary): SeatPay {
  if (seat.pendingCents > 0) return 'pending'
  if (seat.totals.owedCents === 0) return 'none'
  if (seat.remainingCents === 0) return 'paid'
  if (seat.claimedUnits === 0 && seat.totals.paidCents === 0) return 'idle'
  return 'due'
}

export const SEAT_PILL: Record<SeatPay, { tone: PillTone; label: string }> = {
  paid: { tone: 'paid', label: 'Платено' },
  pending: { tone: 'pending', label: 'Чака' },
  due: { tone: 'due', label: 'Дължи' },
  idle: { tone: 'neutral', label: 'Без артикули' },
  none: { tone: 'neutral', label: 'Без дял' },
}
