import { describe, expect, it } from 'vitest'
import { isDevMode, isDevModeEnabled } from './devMode'

describe('isDevModeEnabled', () => {
  it('is false when DEV_MODE is unset', () => {
    const previousMode = process.env.DEV_MODE
    const previousDeployment = process.env.CONVEX_DEPLOYMENT
    delete process.env.DEV_MODE
    delete process.env.CONVEX_DEPLOYMENT
    expect(isDevModeEnabled()).toBe(false)
    process.env.DEV_MODE = previousMode
    process.env.CONVEX_DEPLOYMENT = previousDeployment
  })

  it('is true when DEV_MODE is set on a dev deployment', () => {
    const previousMode = process.env.DEV_MODE
    const previousDeployment = process.env.CONVEX_DEPLOYMENT
    process.env.DEV_MODE = 'true'
    process.env.CONVEX_DEPLOYMENT = 'striped-shepherd-984'
    expect(isDevModeEnabled()).toBe(true)
    process.env.DEV_MODE = previousMode
    process.env.CONVEX_DEPLOYMENT = previousDeployment
  })

  it('is true when DEV_MODE is set with local dev: prefix', () => {
    const previousMode = process.env.DEV_MODE
    const previousDeployment = process.env.CONVEX_DEPLOYMENT
    process.env.DEV_MODE = 'true'
    process.env.CONVEX_DEPLOYMENT = 'dev:striped-shepherd-984'
    expect(isDevModeEnabled()).toBe(true)
    process.env.DEV_MODE = previousMode
    process.env.CONVEX_DEPLOYMENT = previousDeployment
  })

  it('is false when DEV_MODE is true on a prod deployment', () => {
    const previousMode = process.env.DEV_MODE
    const previousDeployment = process.env.CONVEX_DEPLOYMENT
    process.env.DEV_MODE = 'true'
    process.env.CONVEX_DEPLOYMENT = 'coordinated-warbler-782'
    expect(isDevModeEnabled()).toBe(false)
    expect(isDevMode()).toBe(false)
    process.env.DEV_MODE = previousMode
    process.env.CONVEX_DEPLOYMENT = previousDeployment
  })
})
