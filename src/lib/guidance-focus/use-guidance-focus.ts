import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import type { GuidanceStep } from '../../../shared/host-onboarding.ts'
import {
  createNextButtonPopTracker,
  focusPlanForStep,
  planNextButtonPop,
  shouldScrollPopForStep,
} from '../../../shared/guidance-controller.ts'
import type { NextButtonPopTracker } from '../../../shared/guidance-controller.ts'
import {
  prefersReducedMotion,
  runScrollPopSequence,
} from './scroll-pop-target.ts'

export type GuidanceTargetRegister = (
  stepId: string,
  element: HTMLElement | null,
) => void

export interface GuidanceFocusHandle {
  registerTarget: GuidanceTargetRegister
  poppingStepId: string | null
  reducedHighlightStepId: string | null
  activeStepId: string | undefined
  onPopAnimationEnd: (stepId: string) => void
  queueStepFocus: (stepId: string) => void
  nextButtonPopToken: number
  onNextButtonPopEnd: () => void
}

export interface UseGuidanceFocusOptions {
  enabled: boolean
  activeStep: GuidanceStep | undefined
  currentEditorStep: BillStep
  editorStepGuidanceComplete: boolean
  /** When true, defer next-button pop (e.g. add-guest input still focused). */
  blockAutoNavigation?: boolean
  /** When false, queue the pop until the step nav bar is visible (e.g. review sheet). */
  canShowNextButtonPop?: boolean
}

export function useGuidanceFocus(
  options: UseGuidanceFocusOptions,
): GuidanceFocusHandle {
  const targetsRef = useRef(new Map<string, HTMLElement>())
  const [poppingStepId, setPoppingStepId] = useState<string | null>(null)
  const [reducedHighlightStepId, setReducedHighlightStepId] = useState<
    string | null
  >(null)
  const [nextButtonPopToken, setNextButtonPopToken] = useState(0)
  const lastScrolledStepIdRef = useRef<string | null>(null)
  const prevActiveStepIdRef = useRef<string | undefined>(undefined)
  const prevEditorStepRef = useRef(options.currentEditorStep)
  const queuedStepIdRef = useRef<string | null>(null)
  const scrollCleanupRef = useRef<(() => void) | null>(null)
  const nextButtonPopTrackerRef = useRef<NextButtonPopTracker>(
    createNextButtonPopTracker(
      options.currentEditorStep,
      options.editorStepGuidanceComplete,
    ),
  )
  const [focusRequestVersion, setFocusRequestVersion] = useState(0)
  const [targetsVersion, setTargetsVersion] = useState(0)
  const activeStepIdRef = useRef<string | undefined>(undefined)

  const activeStep = options.enabled ? options.activeStep : undefined
  activeStepIdRef.current = activeStep?.id

  const cancelActiveFocus = useCallback(() => {
    scrollCleanupRef.current?.()
    scrollCleanupRef.current = null
    setPoppingStepId(null)
    setReducedHighlightStepId(null)
  }, [])

  const registerTarget: GuidanceTargetRegister = useCallback(
    (stepId, element) => {
      if (element) {
        targetsRef.current.set(stepId, element)
        if (
          queuedStepIdRef.current === stepId ||
          stepId === activeStepIdRef.current
        ) {
          lastScrolledStepIdRef.current = null
        }
      } else {
        targetsRef.current.delete(stepId)
      }
      setTargetsVersion((version) => version + 1)
    },
    [],
  )

  const queueStepFocus = useCallback((stepId: string) => {
    queuedStepIdRef.current = stepId
    lastScrolledStepIdRef.current = null
    setFocusRequestVersion((version) => version + 1)
  }, [])

  const focusStep = useCallback((step: GuidanceStep) => {
    const { shouldScrollPop, scrollBlock } = focusPlanForStep(step)
    if (!shouldScrollPop) return

    const element = targetsRef.current.get(step.id)
    if (!element) return

    queuedStepIdRef.current = null
    scrollCleanupRef.current?.()

    const cleanup = runScrollPopSequence({
      element,
      block: scrollBlock,
      shouldPop: true,
      onScrollStart: () => {
        lastScrolledStepIdRef.current = step.id
      },
      onPopStart: () => {
        if (prefersReducedMotion()) {
          setReducedHighlightStepId(step.id)
        } else {
          setPoppingStepId(step.id)
        }
      },
    })

    scrollCleanupRef.current = cleanup
    return cleanup
  }, [])

  useLayoutEffect(() => {
    if (prevEditorStepRef.current !== options.currentEditorStep) {
      lastScrolledStepIdRef.current = null
      prevEditorStepRef.current = options.currentEditorStep
    }
  }, [options.currentEditorStep])

  useLayoutEffect(() => {
    if (!options.enabled) {
      cancelActiveFocus()
    }
  }, [options.enabled, cancelActiveFocus])

  useLayoutEffect(() => {
    const result = planNextButtonPop({
      tracker: nextButtonPopTrackerRef.current,
      enabled: options.enabled,
      editorStep: options.currentEditorStep,
      stepComplete: options.editorStepGuidanceComplete,
      blocked: options.blockAutoNavigation ?? false,
      canShow: options.canShowNextButtonPop ?? true,
    })

    nextButtonPopTrackerRef.current = result.tracker

    if (result.triggerPop) {
      setNextButtonPopToken((token) => token + 1)
    }
  }, [
    options.enabled,
    options.currentEditorStep,
    options.editorStepGuidanceComplete,
    options.blockAutoNavigation,
    options.canShowNextButtonPop,
  ])

  useLayoutEffect(() => {
    if (!options.enabled || !activeStep) return

    if (prevActiveStepIdRef.current !== activeStep.id) {
      lastScrolledStepIdRef.current = null
      prevActiveStepIdRef.current = activeStep.id
    }

    if (!shouldScrollPopForStep(activeStep.id)) {
      return
    }

    if (activeStep.step !== options.currentEditorStep) {
      return
    }

    const queuedStepId = queuedStepIdRef.current
    const shouldForceFocus =
      queuedStepId !== null && queuedStepId === activeStep.id

    if (!shouldForceFocus && lastScrolledStepIdRef.current === activeStep.id) {
      return
    }

    const cleanup = focusStep(activeStep)
    return () => {
      cleanup?.()
      if (scrollCleanupRef.current === cleanup) {
        scrollCleanupRef.current = null
      }
    }
  }, [
    activeStep,
    options.enabled,
    options.currentEditorStep,
    focusStep,
    targetsVersion,
    focusRequestVersion,
  ])

  const onPopAnimationEnd = useCallback((stepId: string) => {
    setPoppingStepId((current) => (current === stepId ? null : current))
  }, [])

  const onNextButtonPopEnd = useCallback(() => {
    // Token is monotonic; nothing to reset. Hook for future side effects.
  }, [])

  return {
    registerTarget,
    poppingStepId,
    reducedHighlightStepId,
    activeStepId: activeStep?.id,
    onPopAnimationEnd,
    queueStepFocus,
    nextButtonPopToken,
    onNextButtonPopEnd,
  }
}
