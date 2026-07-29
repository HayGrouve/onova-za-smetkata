import type {
  BillBreakdownInput,
  ItemBreakdownInput,
  ParticipantBreakdownLine,
  ParticipantTotals,
  PaymentStatus,
} from './bill-calculations'
import {
  calculateBillTotals,
  calculateParticipantBreakdown,
  lineTotalCents,
} from './bill-calculations'
import type { BillCalculationSnapshot } from './bill-calculation-snapshot'

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABELS[status]
}

export function formatBreakdownLineLabel(
  line: ParticipantBreakdownLine,
  participantCount: number,
): string {
  if (line.kind === 'tip') {
    return participantCount > 1 ? `Бакшиш (1/${participantCount})` : 'Бакшиш'
  }
  return line.label
}

export function formatBreakdownLineUnitsText(
  line: ParticipantBreakdownLine,
): string | undefined {
  if (line.kind !== 'item') return undefined
  if (line.units === undefined || line.totalUnits === undefined)
    return undefined
  if (line.totalUnits <= 1) return undefined
  return `${line.units} от ${line.totalUnits}`
}

export function formatBreakdownLineSharedText(
  line: ParticipantBreakdownLine,
  labels?: Record<string, string>,
): string | undefined {
  if (line.kind !== 'item') return undefined
  if (line.sharedWithCount === undefined || line.sharedWithCount <= 0) {
    return undefined
  }

  const ids = line.sharedWithParticipantIds ?? []
  if (labels && ids.length > 0) {
    const names = ids.map((id) => labels[id] ?? 'Участник')
    return `Споделено с ${names.join(', ')}`
  }
  return `Споделено с ${line.sharedWithCount}`
}

function formatBreakdownLineSharedSuffix(
  line: ParticipantBreakdownLine,
  labels?: Record<string, string>,
): string | undefined {
  if (line.kind !== 'item') return undefined
  if (line.sharedWithCount === undefined || line.sharedWithCount <= 0) {
    return undefined
  }

  const ids = line.sharedWithParticipantIds ?? []
  if (labels && ids.length > 0) {
    const names = ids.map((id) => labels[id] ?? 'Участник')
    return `споделено с ${names.join(', ')}`
  }
  return `споделено с ${line.sharedWithCount}`
}

export function formatBreakdownLineSuffix(
  line: ParticipantBreakdownLine,
  labels?: Record<string, string>,
): string {
  if (line.kind !== 'item') return ''

  const parts: string[] = []
  const unitsText = formatBreakdownLineUnitsText(line)
  if (unitsText) parts.push(unitsText)

  const sharedSuffix = formatBreakdownLineSharedSuffix(line, labels)
  if (sharedSuffix) parts.push(sharedSuffix)

  return parts.length > 0 ? ` · ${parts.join(' · ')}` : ''
}

export interface ParticipantShareLineView {
  key: string
  kind: 'item' | 'tip'
  label: string
  unitsText?: string
  sharedText?: string
  suffix: string
  amountCents: number
}

export interface ParticipantShareView {
  participantId: string
  totals: ParticipantTotals
  statusLabel: string
  remainingCents: number
  lines: ParticipantShareLineView[]
  isEmpty: boolean
  participantCount: number
}

export interface ParticipantShareViewInput {
  breakdownInput: BillBreakdownInput
  totals: ParticipantTotals
  participantId: string
  participantLabels?: Record<string, string>
}

export function buildParticipantShareView(
  input: ParticipantShareViewInput,
): ParticipantShareView {
  const { breakdownInput, totals, participantId, participantLabels } = input
  const breakdown = calculateParticipantBreakdown(breakdownInput, participantId)
  const participantCount = breakdownInput.participants.length

  const lines: ParticipantShareLineView[] = breakdown.lines.map(
    (line, index) => {
      const key =
        line.kind === 'item' ? `item-${line.itemId}-${index}` : `tip-${index}`

      return {
        key,
        kind: line.kind,
        label: formatBreakdownLineLabel(line, participantCount),
        unitsText:
          line.kind === 'item' ? formatBreakdownLineUnitsText(line) : undefined,
        sharedText:
          line.kind === 'item'
            ? formatBreakdownLineSharedText(line, participantLabels)
            : undefined,
        suffix:
          line.kind === 'item'
            ? formatBreakdownLineSuffix(line, participantLabels)
            : '',
        amountCents: line.amountCents,
      }
    },
  )

  return {
    participantId,
    totals,
    statusLabel: paymentStatusLabel(totals.status),
    remainingCents: Math.max(0, totals.balanceCents),
    lines,
    isEmpty: lines.length === 0,
    participantCount,
  }
}

export function buildParticipantShareViewFromSnapshot(
  snapshot: BillCalculationSnapshot,
  participantId: string,
  participantLabels?: Record<string, string>,
): ParticipantShareView {
  const billTotals = calculateBillTotals(snapshot.calculationInput)
  if (!(participantId in billTotals.byParticipant)) {
    throw new Error(`Unknown participant: ${participantId}`)
  }
  const totals = billTotals.byParticipant[participantId]

  return buildParticipantShareView({
    breakdownInput: snapshot.breakdownInput,
    totals,
    participantId,
    participantLabels,
  })
}

function labelForParticipant(
  participantId: string,
  labels: Record<string, string>,
): string {
  return labels[participantId] ?? 'Участник'
}

export function formatItemAssigneesText(
  item: ItemBreakdownInput,
  breakdown: BillBreakdownInput,
  labels: Record<string, string>,
  formatAmount: (cents: number) => string,
): string {
  const itemAssignments = breakdown.assignments.filter(
    (assignment) => assignment.itemId === item.id,
  )
  if (itemAssignments.length === 0) return 'неразпределено'

  const byParticipant = new Map<string, number>()
  for (const assignment of itemAssignments) {
    byParticipant.set(
      assignment.participantId,
      (byParticipant.get(assignment.participantId) ?? 0) + 1,
    )
  }

  const sorted = [...byParticipant.entries()].sort(
    (a, b) =>
      (breakdown.participants.find((participant) => participant.id === a[0])
        ?.sortOrder ?? 0) -
      (breakdown.participants.find((participant) => participant.id === b[0])
        ?.sortOrder ?? 0),
  )

  return sorted
    .map(([assigneeId, unitsJoined]) => {
      const amountCents = calculateParticipantBreakdown(breakdown, assigneeId)
        .lines.filter((line) => line.kind === 'item' && line.itemId === item.id)
        .reduce((sum, line) => sum + line.amountCents, 0)
      const name = labelForParticipant(assigneeId, labels)
      if (item.quantity > 1) {
        return `${name} ${unitsJoined} бр. (${formatAmount(amountCents)})`
      }
      return `${name} (${formatAmount(amountCents)})`
    })
    .join(' · ')
}

export function formatBillItemsSectionText(
  breakdown: BillBreakdownInput,
  labels: Record<string, string>,
  formatAmount: (cents: number) => string,
): string[] {
  const lines: string[] = ['Артикули']

  for (const item of breakdown.items) {
    const totalCents = lineTotalCents(item)
    if (totalCents <= 0) continue

    const quantitySuffix = item.quantity > 1 ? ` ×${item.quantity}` : ''
    lines.push(`• ${item.name}${quantitySuffix} — ${formatAmount(totalCents)}`)
    lines.push(
      `  ${formatItemAssigneesText(item, breakdown, labels, formatAmount)}`,
    )
  }

  const tipCents = breakdown.tipCents ?? 0
  if (tipCents > 0) {
    const participantCount = breakdown.participants.length
    const shareLabel =
      participantCount > 1 ? `поравно между ${participantCount}` : 'цялата сума'
    lines.push(`• Бакшиш — ${formatAmount(tipCents)} (${shareLabel})`)
  }

  return lines
}

export function formatParticipantShareSectionText(
  participantLabel: string,
  view: ParticipantShareView,
  formatAmount: (cents: number) => string,
): string[] {
  const lines: string[] = [`▸ ${participantLabel}`]

  if (view.isEmpty) {
    lines.push('  (няма разпределени артикули)')
  } else {
    for (const line of view.lines) {
      lines.push(
        `  • ${line.label}${line.suffix} — ${formatAmount(line.amountCents)}`,
      )
    }
  }

  const { owedCents, paidCents } = view.totals
  lines.push(
    `  Дължи ${formatAmount(owedCents)} · Платено ${formatAmount(paidCents)} · Остатък ${formatAmount(view.remainingCents)} — ${view.statusLabel}`,
  )

  return lines
}
