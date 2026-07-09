import type { PaymentStatus } from '#/lib/bill-calculations.ts'

export function getPaymentRowBorderClass(status: PaymentStatus): string {
  if (status === 'unpaid') return 'border-l-4 border-red-500'
  if (status === 'partial') return 'border-l-4 border-accent-foreground'
  return ''
}
