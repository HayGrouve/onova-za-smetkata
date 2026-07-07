import type { PaymentStatus } from './bill-calculations.ts'

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
  return (cents / 100).toFixed(2)
}

export interface ShareParticipantLine {
  label: string
  owedCents: number
  status: PaymentStatus
}

export interface BillShareInput {
  restaurantName: string
  date: Date
  billTotalCents: number
  participants: ShareParticipantLine[]
}

export function formatBillShareText(input: BillShareInput): string {
  const title = input.restaurantName.trim() || 'Без име'
  const header = `Сметка: ${title}, ${dateFormatter.format(input.date)}`
  const total = `Общо: ${formatCopyAmount(input.billTotalCents)} EUR`
  const lines = input.participants.map(
    (p) =>
      `${p.label}: ${formatCopyAmount(p.owedCents)} EUR — ${statusLabels[p.status]}`,
  )
  return [header, total, '', ...lines].join('\n')
}

export async function shareOrCopyText(text: string, title: string): Promise<'shared' | 'copied'> {
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
