import { describe, expect, it } from 'vitest'
import { getAssignmentEditableError } from '../../convex/lib/assertAssignmentEditable'

describe('getAssignmentEditableError', () => {
  it('returns bill_final when bill is final', () => {
    expect(
      getAssignmentEditableError({
        billStatus: 'final',
        itemBillId: 'bill_1' as never,
        participantBillId: 'bill_1' as never,
      }),
    ).toBe('bill_final')
  })

  it('returns participant_not_on_bill when participant bill mismatches', () => {
    expect(
      getAssignmentEditableError({
        billStatus: 'draft',
        itemBillId: 'bill_1' as never,
        participantBillId: 'bill_2' as never,
      }),
    ).toBe('participant_not_on_bill')
  })

  it('returns null when editable', () => {
    expect(
      getAssignmentEditableError({
        billStatus: 'draft',
        itemBillId: 'bill_1' as never,
        participantBillId: 'bill_1' as never,
      }),
    ).toBeNull()
  })
})
