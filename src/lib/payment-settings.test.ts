import { describe, expect, it } from 'vitest'
import { buildRevolutUrl } from './payment-settings.ts'

describe('buildRevolutUrl', () => {
  it('builds revolut.me link with amount in cents and EUR currency', () => {
    expect(buildRevolutUrl('yourname', 1250)).toBe(
      'https://revolut.me/yourname?amount=1250&currency=EUR',
    )
    expect(buildRevolutUrl('haygrouve', 5783)).toBe(
      'https://revolut.me/haygrouve?amount=5783&currency=EUR',
    )
  })

  it('strips @ prefix from username', () => {
    expect(buildRevolutUrl('@yourname', 500)).toBe(
      'https://revolut.me/yourname?amount=500&currency=EUR',
    )
  })
})
