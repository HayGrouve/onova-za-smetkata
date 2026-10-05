import { describe, expect, it } from 'vitest'
import { getConvexErrorMessage } from './convex-error.ts'

describe('getConvexErrorMessage', () => {
  it('extracts Uncaught ConvexError message from client wrapper', () => {
    const message =
      '[CONVEX M(hostOnboarding:createFirstBill)] [Request ID: abc] Server Error Uncaught ConvexError: Първоначалните напътствия са само когато все още нямате сметки.\n    at handler (../convex/hostOnboarding.ts:64:23)'

    expect(getConvexErrorMessage(new Error(message))).toBe(
      'Първоначалните напътствия са само когато все още нямате сметки.',
    )
  })

  it('returns plain Error messages unchanged', () => {
    expect(getConvexErrorMessage(new Error('Името не може да е празно'))).toBe(
      'Името не може да е празно',
    )
  })

  it('reads string data from Convex-shaped errors', () => {
    expect(getConvexErrorMessage({ data: 'Недостъпно извън DEV_MODE.' })).toBe(
      'Недостъпно извън DEV_MODE.',
    )
  })

  it('falls back for unknown errors', () => {
    expect(getConvexErrorMessage(null)).toBe('Неуспешна операция')
  })
})
