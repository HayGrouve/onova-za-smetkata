import { describe, expect, it } from 'vitest'
import { buildRevolutUrl } from './payment-settings.ts'

describe('buildRevolutUrl', () => {
  it('builds revolut.me link with amount and EUR currency query params', () => {
    expect(buildRevolutUrl('yourname', 1250)).toBe(
      'https://revolut.me/yourname?amount=12.50&currency=EUR',
    )
  })

  it('strips @ prefix from username', () => {
    expect(buildRevolutUrl('@yourname', 500)).toBe(
      'https://revolut.me/yourname?amount=5.00&currency=EUR',
    )
  })
})
