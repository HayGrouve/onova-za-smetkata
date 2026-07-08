import { afterEach, describe, expect, it, vi } from 'vitest'
import { isDevModeEnabled } from './devMode'

describe('isDevModeEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when DEV_MODE is unset', () => {
    vi.stubEnv('DEV_MODE', '')
    vi.stubEnv('CONVEX_DEPLOYMENT', 'striped-shepherd-984')
    expect(isDevModeEnabled()).toBe(false)
  })

  it('returns true for allowlisted dev deployment', () => {
    vi.stubEnv('DEV_MODE', 'true')
    vi.stubEnv('CONVEX_DEPLOYMENT', 'striped-shepherd-984')
    expect(isDevModeEnabled()).toBe(true)
  })

  it('returns false for unknown deployment even when DEV_MODE=true', () => {
    vi.stubEnv('DEV_MODE', 'true')
    vi.stubEnv('CONVEX_DEPLOYMENT', 'random-unknown-slug')
    expect(isDevModeEnabled()).toBe(false)
  })

  it('returns false for prod slug even when DEV_MODE=true', () => {
    vi.stubEnv('DEV_MODE', 'true')
    vi.stubEnv('CONVEX_DEPLOYMENT', 'coordinated-warbler-782')
    expect(isDevModeEnabled()).toBe(false)
  })

  it('honors CONVEX_DEV_DEPLOYMENTS env extension', () => {
    vi.stubEnv('DEV_MODE', 'true')
    vi.stubEnv('CONVEX_DEPLOYMENT', 'my-custom-dev')
    vi.stubEnv('CONVEX_DEV_DEPLOYMENTS', 'my-custom-dev')
    expect(isDevModeEnabled()).toBe(true)
  })
})
