import { describe, expect, it } from 'vitest'
import { ConvexError } from 'convex/values'
import { assertBillDraft } from './assertBillDraft'
import { GUEST_FLOW_MESSAGES } from './guestFlowMessages'

describe('assertBillDraft', () => {
  it('passes when status is draft', () => {
    expect(() => assertBillDraft({ status: 'draft' })).not.toThrow()
  })

  it('throws billFinalNoEdit when status is final', () => {
    expect(() => assertBillDraft({ status: 'final' })).toThrow(ConvexError)
    try {
      assertBillDraft({ status: 'final' })
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError)
      expect((error as ConvexError).data).toBe(
        GUEST_FLOW_MESSAGES.billFinalNoEdit,
      )
    }
  })
})
