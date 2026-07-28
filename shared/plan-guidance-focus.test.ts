import { describe, expect, it } from 'vitest'
import {
  GUIDANCE_FOCUS_TIMING,
  scrollBlockForStep,
  shouldScrollPopForStep,
} from './plan-guidance-focus.ts'

describe('shouldScrollPopForStep', () => {
  it('skips passive scan-processing', () => {
    expect(shouldScrollPopForStep('scan-processing')).toBe(false)
  })

  it('scrolls interactive steps', () => {
    expect(shouldScrollPopForStep('scan-upload')).toBe(true)
    expect(shouldScrollPopForStep('allocation')).toBe(true)
  })
})

describe('scrollBlockForStep', () => {
  it('uses start block for restaurant field', () => {
    expect(scrollBlockForStep('restaurant')).toBe('start')
  })

  it('defaults to center for unknown steps', () => {
    expect(scrollBlockForStep('unknown-step')).toBe('center')
  })
})

describe('GUIDANCE_FOCUS_TIMING', () => {
  it('matches the agreed fog constants', () => {
    expect(GUIDANCE_FOCUS_TIMING.UI_SETTLE_DELAY_MS).toBe(800)
    expect(GUIDANCE_FOCUS_TIMING.POP_AFTER_SCROLL_MS).toBe(550)
    expect(GUIDANCE_FOCUS_TIMING.SHEET_CLOSE_SETTLE_MS).toBe(350)
  })
})
