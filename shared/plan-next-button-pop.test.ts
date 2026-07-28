import { describe, expect, it } from 'vitest'
import {
  createNextButtonPopTracker,
  planNextButtonPop,
} from './plan-next-button-pop'

describe('planNextButtonPop', () => {
  it('does not pop on first run even when the step is already complete', () => {
    const tracker = createNextButtonPopTracker(1, true)
    const result = planNextButtonPop({
      tracker,
      enabled: true,
      editorStep: 1,
      stepComplete: true,
      blocked: false,
      canShow: true,
    })

    expect(result.triggerPop).toBe(false)
    expect(result.tracker.poppedForStep).toBe(1)
  })

  it('pops when the current step transitions from incomplete to complete', () => {
    let tracker = createNextButtonPopTracker(1, false)
    tracker = planNextButtonPop({
      tracker,
      enabled: true,
      editorStep: 1,
      stepComplete: false,
      blocked: false,
      canShow: true,
    }).tracker

    const result = planNextButtonPop({
      tracker,
      enabled: true,
      editorStep: 1,
      stepComplete: true,
      blocked: false,
      canShow: true,
    })

    expect(result.triggerPop).toBe(true)
    expect(result.tracker.poppedForStep).toBe(1)
  })

  it('defers pop until the nav bar becomes visible', () => {
    let tracker = createNextButtonPopTracker(1, false)
    tracker = planNextButtonPop({
      tracker,
      enabled: true,
      editorStep: 1,
      stepComplete: false,
      blocked: false,
      canShow: true,
    }).tracker

    const hidden = planNextButtonPop({
      tracker,
      enabled: true,
      editorStep: 1,
      stepComplete: true,
      blocked: false,
      canShow: false,
    })

    expect(hidden.triggerPop).toBe(false)
    expect(hidden.tracker.pendingPop).toBe(true)

    const visible = planNextButtonPop({
      tracker: hidden.tracker,
      enabled: true,
      editorStep: 1,
      stepComplete: true,
      blocked: false,
      canShow: true,
    })

    expect(visible.triggerPop).toBe(true)
  })

  it('pops after unblock when the step completed while blocked', () => {
    let tracker = createNextButtonPopTracker(2, false)
    tracker = planNextButtonPop({
      tracker,
      enabled: true,
      editorStep: 2,
      stepComplete: false,
      blocked: false,
      canShow: true,
    }).tracker

    tracker = planNextButtonPop({
      tracker,
      enabled: true,
      editorStep: 2,
      stepComplete: true,
      blocked: true,
      canShow: true,
    }).tracker

    expect(tracker.pendingPop).toBe(true)

    const result = planNextButtonPop({
      tracker,
      enabled: true,
      editorStep: 2,
      stepComplete: true,
      blocked: false,
      canShow: true,
    })

    expect(result.triggerPop).toBe(true)
  })

  it('clears pop when changing editor steps', () => {
    let tracker = createNextButtonPopTracker(1, true)
    tracker = planNextButtonPop({
      tracker,
      enabled: true,
      editorStep: 1,
      stepComplete: true,
      blocked: false,
      canShow: true,
    }).tracker

    const result = planNextButtonPop({
      tracker,
      enabled: true,
      editorStep: 2,
      stepComplete: false,
      blocked: false,
      canShow: true,
    })

    expect(result.clearPop).toBe(true)
    expect(result.triggerPop).toBe(false)
    expect(result.tracker.poppedForStep).toBeNull()
  })
})
