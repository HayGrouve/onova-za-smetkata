import { formatEur } from '#/lib/format-currency.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { CASH_ROUNDING_CENTS } from '../../shared/quick-bill.ts'
import type { QuickBill, QuickBillSummary } from '../../shared/quick-bill.ts'

/**
 * The quick bill as a message for the group chat. The quick bill itself is
 * thrown away, so this text is all that is left of it.
 */
export function formatQuickBillShareText(
  bill: QuickBill,
  summary: QuickBillSummary,
): string {
  const labels = buildParticipantLabels(
    summary.seats.map((seat, index) => ({
      _id: seat.id,
      name: seat.label,
      sortOrder: index,
    })),
  )
  const restaurant = bill.restaurantName.trim()
  const lines = [restaurant ? `Бърза сметка: ${restaurant}` : 'Бърза сметка']
  lines.push('')
  for (const seat of summary.seats) {
    if (seat.amountCents === 0) continue
    lines.push(
      `${labels[seat.id] ?? seat.label}: ${formatEur(seat.amountCents)}`,
    )
  }
  lines.push('')
  if (summary.tipCents > 0) {
    lines.push(`С бакшиш ${bill.tipPercent}%, разделен поравно`)
  }
  if (bill.roundForCash) {
    lines.push(`Закръглено до ${formatEur(CASH_ROUNDING_CENTS)}`)
  }
  if (summary.unassignedCents > 0) {
    lines.push(`Неразпределено: ${formatEur(summary.unassignedCents)}`)
  }
  lines.push(`Общо: ${formatEur(summary.totalCents)}`)
  if (summary.amountsTotalCents !== summary.totalCents) {
    lines.push(`След закръгляне: ${formatEur(summary.amountsTotalCents)}`)
  }
  return lines.join('\n')
}
