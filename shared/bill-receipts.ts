/** Receipt photos one bill may hold (e.g. a few shops for one party). */
export const MAX_RECEIPTS_PER_BILL = 10

export const BILL_RECEIPT_MESSAGES = {
  tooMany: `Може да прикачиш до ${MAX_RECEIPTS_PER_BILL} бележки към една сметка.`,
  notFound: 'Бележката не е намерена.',
  noReceiptToReplace: 'Сканирането не е от прикачена бележка.',
} as const
