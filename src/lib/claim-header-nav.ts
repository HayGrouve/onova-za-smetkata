/**
 * Back navigation for the claim route.
 * Host mode returns to the bill editor (items step); guests have no header back.
 */
export function getClaimHeaderBack(input: {
  billId: string
  mode?: 'host'
}): {
  backTo: '/bills/$billId'
  backParams: { billId: string }
  backSearch: { step: 3 }
} | null {
  if (input.mode !== 'host') return null
  return {
    backTo: '/bills/$billId',
    backParams: { billId: input.billId },
    backSearch: { step: 3 },
  }
}
