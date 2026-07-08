import { describe, expect, it } from 'vitest'
import { isDevMode } from './devMode'

describe('isDevMode', () => {
  it('is false when DEV_MODE is unset', () => {
    const previous = process.env.DEV_MODE
    delete process.env.DEV_MODE
    expect(isDevMode()).toBe(false)
    process.env.DEV_MODE = previous
  })

  it('is true when DEV_MODE is "true"', () => {
    const previous = process.env.DEV_MODE
    process.env.DEV_MODE = 'true'
    expect(isDevMode()).toBe(true)
    process.env.DEV_MODE = previous
  })
})
