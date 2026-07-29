import type {
  BillBreakdownInput,
  ParticipantTotals,
} from './bill-calculations.ts'
import { formatEur } from './format-currency.ts'
import {
  buildParticipantShareView,
  formatBillItemsSectionText,
  formatBreakdownLineLabel,
  formatBreakdownLineSharedText,
  formatBreakdownLineSuffix,
  formatBreakdownLineUnitsText,
  formatParticipantShareSectionText,
  paymentStatusLabel,
} from '../../shared/participant-share-view.ts'

export {
  buildParticipantShareView,
  buildParticipantShareViewFromSnapshot,
  formatBreakdownLineLabel,
  formatBreakdownLineSharedText,
  formatBreakdownLineSuffix,
  formatBreakdownLineUnitsText,
  paymentStatusLabel,
} from '../../shared/participant-share-view.ts'
export type {
  ParticipantShareLineView,
  ParticipantShareView,
  ParticipantShareViewInput,
} from '../../shared/participant-share-view.ts'

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

const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatBillShareText(input: BillShareInput): string {
  const title = input.restaurantName.trim() || 'Без име'
  const labels = Object.fromEntries(
    input.participants.map((participant) => [
      participant.id,
      participant.label,
    ]),
  )
  const sortedParticipants = [...input.participants].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  const sections: string[] = [
    `Сметка: ${title}`,
    dateFormatter.format(input.date),
  ]

  const trimmedNote = input.note?.trim()
  if (trimmedNote) {
    sections.push(`Бележка: ${trimmedNote}`)
  }

  sections.push('')
  sections.push(
    ...formatBillItemsSectionText(input.breakdown, labels, formatShareAmount),
  )
  sections.push('')
  sections.push(`Общо: ${formatShareAmount(input.billTotalCents)}`)
  sections.push('')
  sections.push('Участници')

  for (const participant of sortedParticipants) {
    const view = buildParticipantShareView({
      breakdownInput: input.breakdown,
      totals: participant.totals,
      participantId: participant.id,
      participantLabels: labels,
    })

    sections.push('')
    sections.push(
      ...formatParticipantShareSectionText(
        participant.label,
        view,
        formatShareAmount,
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
