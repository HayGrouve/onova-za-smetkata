import type {
  BillBreakdownInput,
  ItemBreakdownInput,
  ParticipantBreakdownLine,
  ParticipantTotals,
  PaymentStatus,
} from './bill-calculations.ts'
import {
  calculateParticipantBreakdown,
  lineTotalCents,
  splitLineTotal,
} from './bill-calculations.ts'

const statusLabels: Record<PaymentStatus, string> = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
}

const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatCopyAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function formatRevolutAmount(cents: number): string {
  return String(cents)
}

export interface ShareParticipantLine {
  id: string
  label: string
  sortOrder: number
  totals: ParticipantTotals
}

export interface BillShareInput {
  restaurantName: string
  date: Date
  note?: string
  billTotalCents: number
  breakdown: BillBreakdownInput
  participants: ShareParticipantLine[]
}

export function formatBreakdownLineLabel(
  line: ParticipantBreakdownLine,
  participantCount: number,
): string {
  if (line.kind === 'tip') {
    return participantCount > 1
      ? `Бакшиш (1/${participantCount})`
      : 'Бакшиш'
  }
  return line.label
}

export function formatBreakdownLineSuffix(
  line: ParticipantBreakdownLine,
): string {
  if (line.kind !== 'item') return ''
  if (line.units !== undefined && line.totalUnits !== undefined) {
    if (line.totalUnits <= 1) return ''
    return ` · ${line.units} от ${line.totalUnits}`
  }
  if (line.sharedWithCount !== undefined && line.sharedWithCount > 0) {
    return ` · споделено с ${line.sharedWithCount}`
  }
  return ''
}

function sortedParticipantIds(
  participantIds: string[],
  participants: BillBreakdownInput['participants'],
): string[] {
  return [...participantIds].sort((a, b) => {
    const orderA = participants.find((p) => p.id === a)?.sortOrder ?? 0
    const orderB = participants.find((p) => p.id === b)?.sortOrder ?? 0
    return orderA - orderB
  })
}

function labelForParticipant(
  participantId: string,
  labels: Record<string, string>,
): string {
  return labels[participantId] ?? 'Участник'
}

function formatItemAssignees(
  item: ItemBreakdownInput,
  breakdown: BillBreakdownInput,
  labels: Record<string, string>,
): string {
  const itemAssignments = breakdown.assignments.filter((a) => a.itemId === item.id)
  if (itemAssignments.length === 0) return 'неразпределено'

  const usesUnits = itemAssignments.some((a) => a.units !== undefined)
  if (usesUnits) {
    const sorted = [...itemAssignments]
      .filter((a) => (a.units ?? 0) > 0)
      .sort(
        (a, b) =>
          (breakdown.participants.find((p) => p.id === a.participantId)
            ?.sortOrder ?? 0) -
          (breakdown.participants.find((p) => p.id === b.participantId)
            ?.sortOrder ?? 0),
      )

    return sorted
      .map((assignment) => {
        const units = assignment.units ?? 0
        const amountCents = units * item.unitPriceCents
        const name = labelForParticipant(assignment.participantId, labels)
        if (item.quantity > 1) {
          return `${name} ${units} бр. (${formatCopyAmount(amountCents)} EUR)`
        }
        return `${name} (${formatCopyAmount(amountCents)} EUR)`
      })
      .join(' · ')
  }

  const assignedIds = itemAssignments.map((a) => a.participantId)
  const sortedIds = sortedParticipantIds(assignedIds, breakdown.participants)
  const portions = splitLineTotal(lineTotalCents(item), sortedIds)

  return portions
    .map(
      (portion) =>
        `${labelForParticipant(portion.id, labels)} (${formatCopyAmount(portion.cents)} EUR)`,
    )
    .join(' · ')
}

function formatItemsSection(
  breakdown: BillBreakdownInput,
  labels: Record<string, string>,
): string[] {
  const lines: string[] = ['Артикули']

  for (const item of breakdown.items) {
    const totalCents = lineTotalCents(item)
    if (totalCents <= 0) continue

    const quantitySuffix = item.quantity > 1 ? ` ×${item.quantity}` : ''
    lines.push(
      `• ${item.name}${quantitySuffix} — ${formatCopyAmount(totalCents)} EUR`,
    )
    lines.push(`  ${formatItemAssignees(item, breakdown, labels)}`)
  }

  const tipCents = breakdown.tipCents ?? 0
  if (tipCents > 0) {
    const participantCount = breakdown.participants.length
    const shareLabel =
      participantCount > 1
        ? `поравно между ${participantCount}`
        : 'цялата сума'
    lines.push(
      `• Бакшиш — ${formatCopyAmount(tipCents)} EUR (${shareLabel})`,
    )
  }

  return lines
}

function formatParticipantSection(
  participant: ShareParticipantLine,
  breakdown: BillBreakdownInput,
  participantCount: number,
): string[] {
  const detail = calculateParticipantBreakdown(breakdown, participant.id)
  const lines: string[] = [`▸ ${participant.label}`]

  if (detail.lines.length === 0) {
    lines.push('  (няма разпределени артикули)')
  } else {
    for (const line of detail.lines) {
      const label = formatBreakdownLineLabel(line, participantCount)
      const suffix =
        line.kind === 'item' ? formatBreakdownLineSuffix(line) : ''
      lines.push(
        `  • ${label}${suffix} — ${formatCopyAmount(line.amountCents)} EUR`,
      )
    }
  }

  const { owedCents, paidCents, balanceCents, status } = participant.totals
  const remainingCents = Math.max(0, balanceCents)
  lines.push(
    `  Дължи ${formatCopyAmount(owedCents)} EUR · Платено ${formatCopyAmount(paidCents)} EUR · Остатък ${formatCopyAmount(remainingCents)} EUR — ${statusLabels[status]}`,
  )

  return lines
}

export function formatBillShareText(input: BillShareInput): string {
  const title = input.restaurantName.trim() || 'Без име'
  const labels = Object.fromEntries(
    input.participants.map((p) => [p.id, p.label]),
  )
  const sortedParticipants = [...input.participants].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  const participantCount = sortedParticipants.length

  const sections: string[] = [
    `Сметка: ${title}`,
    dateFormatter.format(input.date),
  ]

  const trimmedNote = input.note?.trim()
  if (trimmedNote) {
    sections.push(`Бележка: ${trimmedNote}`)
  }

  sections.push('')
  sections.push(...formatItemsSection(input.breakdown, labels))
  sections.push('')
  sections.push(`Общо: ${formatCopyAmount(input.billTotalCents)} EUR`)
  sections.push('')
  sections.push('Участници')

  for (const participant of sortedParticipants) {
    sections.push('')
    sections.push(...formatParticipantSection(participant, input.breakdown, participantCount))
  }

  return sections.join('\n')
}

export async function shareOrCopyText(
  text: string,
  title: string,
): Promise<'shared' | 'copied'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
