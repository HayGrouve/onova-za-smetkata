import { formatEur } from '#/lib/format-currency.ts'
import type { Debtor, DebtorBill } from '../../shared/bill-collection.ts'

const reminderDateFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
})

function describeBill(bill: Pick<DebtorBill, 'restaurantName' | 'date'>) {
  const date = reminderDateFormatter.format(new Date(bill.date))
  const restaurant = bill.restaurantName.trim()
  return restaurant
    ? `сметката в „${restaurant}“ (${date})`
    : `сметката от ${date}`
}

function capitalize(text: string): string {
  return text ? text[0].toLocaleUpperCase('bg-BG') + text.slice(1) : text
}

/**
 * Friendly Bulgarian payment reminder the Host sends from their own messenger.
 * `joinUrlFor` returns the Guest link for a bill (omitted when unavailable).
 */
export function buildPaymentReminder(
  debtor: Pick<Debtor, 'name' | 'outstandingCents' | 'bills'>,
  joinUrlFor: (bill: DebtorBill) => string | undefined,
): string {
  const greeting = `Здрасти, ${debtor.name}!`

  if (debtor.bills.length === 1) {
    const bill = debtor.bills[0]
    const url = joinUrlFor(bill)
    const pay = url ? ` Може да платиш от линка: ${url}` : ''
    return `${greeting} За ${describeBill(bill)} остава ${formatEur(bill.outstandingCents)}.${pay}`
  }

  const lines = debtor.bills.map((bill) => {
    const url = joinUrlFor(bill)
    const line = `• ${capitalize(describeBill(bill))} — ${formatEur(bill.outstandingCents)}`
    return url ? `${line}: ${url}` : line
  })
  return [
    `${greeting} Остават ${debtor.bills.length} сметки:`,
    ...lines,
    `Общо ${formatEur(debtor.outstandingCents)}. Благодаря!`,
  ].join('\n')
}
