import { describe, expect, it } from 'vitest'
import {
  computeGuidanceState,
  createNextButtonPopTracker,
  focusPlanForStep,
  GUIDANCE_FOCUS_TIMING,
  planNextButtonPop,
  scrollBlockForStep,
  shouldScrollPopForStep,
} from './guidance-controller'

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
    expect(GUIDANCE_FOCUS_TIMING.NEXT_BUTTON_POP_DELAY_MS).toBe(800)
  })
})

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
})

describe('computeGuidanceState', () => {
  it('derives active step and editor guidance from bill state', () => {
    const state = computeGuidanceState({
      bill: {
        restaurantName: '',
        restaurantFromOcr: false,
        hostParticipantName: 'Аз',
        guestCount: 0,
        items: [],
        assignments: [],
        contentRoute: 'manual',
        receiptUploaded: false,
        receiptScanning: false,
        scanReviewOpen: false,
      },
      dismissedHintIds: [],
      editorStep: 1,
      stepLabels: ['Бележка', 'Участници', 'Разпределение', 'Преглед'],
    })

    expect(state.activeStep?.id).toBe('restaurant')
    expect(state.editorStepGuidance?.anchor).toBe('bill-details')
    expect(state.stepBarLabel).toEqual({ kind: 'on' })
  })

  it('reports editor step guidance complete when step 1 hints are done', () => {
    const state = computeGuidanceState({
      bill: {
        restaurantName: 'Механа',
        restaurantFromOcr: false,
        hostParticipantName: 'Аз',
        guestCount: 0,
        items: [],
        assignments: [],
        contentRoute: 'manual',
        receiptUploaded: false,
        receiptScanning: false,
        scanReviewOpen: false,
      },
      dismissedHintIds: [],
      editorStep: 1,
      stepLabels: ['Бележка', 'Участници', 'Разпределение', 'Преглед'],
    })

    expect(state.editorStepGuidanceComplete).toBe(true)
    expect(state.stepBarLabel?.kind).toBe('pointer')
  })
})

describe('focusPlanForStep', () => {
  it('returns scroll plan for an active step', () => {
    expect(
      focusPlanForStep({
        id: 'restaurant',
        anchor: 'bill-details',
        step: 1,
        title: '',
        body: '',
        done: false,
      }),
    ).toEqual({ shouldScrollPop: true, scrollBlock: 'start' })
  })
})
