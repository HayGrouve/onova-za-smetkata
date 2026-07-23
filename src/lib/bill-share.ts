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
} from './bill-calculations.ts'
import { formatEur } from './format-currency.ts'

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

function formatShareAmount(cents: number): string {
  return formatEur(cents)
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
    return participantCount > 1 ? `Бакшиш (1/${participantCount})` : 'Бакшиш'
  }
  return line.label
}

export function formatBreakdownLineUnitsText(
  line: ParticipantBreakdownLine,
): string | undefined {
  if (line.kind !== 'item') return undefined
  if (line.units === undefined || line.totalUnits === undefined) return undefined
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
  const itemAssignments = breakdown.assignments.filter(
    (a) => a.itemId === item.id,
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
      (breakdown.participants.find((p) => p.id === a[0])?.sortOrder ?? 0) -
      (breakdown.participants.find((p) => p.id === b[0])?.sortOrder ?? 0),
  )

  return sorted
    .map(([participantId, unitsJoined]) => {
      const amountCents = calculateParticipantBreakdown(
        breakdown,
        participantId,
      )
        .lines.filter((line) => line.kind === 'item' && line.itemId === item.id)
        .reduce((sum, line) => sum + line.amountCents, 0)
      const name = labelForParticipant(participantId, labels)
      if (item.quantity > 1) {
        return `${name} ${unitsJoined} бр. (${formatShareAmount(amountCents)})`
      }
      return `${name} (${formatShareAmount(amountCents)})`
    })
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
      `• ${item.name}${quantitySuffix} — ${formatShareAmount(totalCents)}`,
    )
    lines.push(`  ${formatItemAssignees(item, breakdown, labels)}`)
  }

  const tipCents = breakdown.tipCents ?? 0
  if (tipCents > 0) {
    const participantCount = breakdown.participants.length
    const shareLabel =
      participantCount > 1 ? `поравно между ${participantCount}` : 'цялата сума'
    lines.push(`• Бакшиш — ${formatShareAmount(tipCents)} (${shareLabel})`)
  }

  return lines
}

function formatParticipantSection(
  participant: ShareParticipantLine,
  breakdown: BillBreakdownInput,
  participantCount: number,
  labels: Record<string, string>,
): string[] {
  const detail = calculateParticipantBreakdown(breakdown, participant.id)
  const lines: string[] = [`▸ ${participant.label}`]

  if (detail.lines.length === 0) {
    lines.push('  (няма разпределени артикули)')
  } else {
    for (const line of detail.lines) {
      const label = formatBreakdownLineLabel(line, participantCount)
      const suffix =
        line.kind === 'item' ? formatBreakdownLineSuffix(line, labels) : ''
      lines.push(
        `  • ${label}${suffix} — ${formatShareAmount(line.amountCents)}`,
      )
    }
  }

  const { owedCents, paidCents, balanceCents, status } = participant.totals
  const remainingCents = Math.max(0, balanceCents)
  lines.push(
    `  Дължи ${formatShareAmount(owedCents)} · Платено ${formatShareAmount(paidCents)} · Остатък ${formatShareAmount(remainingCents)} — ${statusLabels[status]}`,
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
  sections.push(`Общо: ${formatShareAmount(input.billTotalCents)}`)
  sections.push('')
  sections.push('Участници')

  for (const participant of sortedParticipants) {
    sections.push('')
    sections.push(
      ...formatParticipantSection(
        participant,
        input.breakdown,
        participantCount,
        labels,
      ),
    )
  }

  return sections.join('\n')
}

export async function shareOrCopyText(
  text: string,
  title: string,
): Promise<'shared' | 'copied'> {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
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
