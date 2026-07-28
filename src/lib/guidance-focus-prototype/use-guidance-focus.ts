import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import type { GuidanceStep } from '../../../shared/host-onboarding.ts'
import { isEditorStepGuidanceComplete } from '../../../shared/host-onboarding.ts'
import {
  createNextButtonPopTracker,
  planNextButtonPop,
} from './plan-next-button-pop.ts'
import type { NextButtonPopTracker } from './plan-next-button-pop.ts'
import {
  resolveActiveGuidanceStep,
  scrollBlockForStep,
  shouldScrollPopForStep,
} from './plan-guidance-focus.ts'
import {
  prefersReducedMotion,
  runScrollPopSequence,
} from './scroll-pop-target.ts'

export type GuidanceTargetRegister = (
  stepId: string,
  element: HTMLElement | null,
) => void

export interface UseGuidanceFocusOptions {
  enabled: boolean
  steps: GuidanceStep[]
  dismissedHintIds: string[]
  currentEditorStep: BillStep
  /** When true, defer next-button pop (e.g. add-guest input still focused). */
  blockAutoNavigation?: boolean
  /** When false, queue the pop until the step nav bar is visible (e.g. review sheet). */
  canShowNextButtonPop?: boolean
}

export interface UseGuidanceFocusResult {
  registerTarget: GuidanceTargetRegister
  poppingStepId: string | null
  reducedHighlightStepId: string | null
  activeStepId: string | undefined
  onPopAnimationEnd: (stepId: string) => void
  /** Re-run scroll+pop for a step (e.g. after receipt upload mounts OCR button). */
  queueStepFocus: (stepId: string) => void
  /** Increments when the step nav “Напред” button should pop. */
  nextButtonPopToken: number
  onNextButtonPopEnd: () => void
}

export function useGuidanceFocus(
  options: UseGuidanceFocusOptions,
): UseGuidanceFocusResult {
  const targetsRef = useRef(new Map<string, HTMLElement>())
  const [poppingStepId, setPoppingStepId] = useState<string | null>(null)
  const [reducedHighlightStepId, setReducedHighlightStepId] = useState<
    string | null
  >(null)
  const [nextButtonPopToken, setNextButtonPopToken] = useState(0)
  const lastScrolledStepIdRef = useRef<string | null>(null)
  const prevActiveStepIdRef = useRef<string | undefined>(undefined)
  const queuedStepIdRef = useRef<string | null>(null)
  const editorStepGuidanceComplete = useMemo(
    () =>
      isEditorStepGuidanceComplete(
        options.steps,
        options.currentEditorStep,
        options.dismissedHintIds,
      ),
    [options.steps, options.currentEditorStep, options.dismissedHintIds],
  )
  const nextButtonPopTrackerRef = useRef<NextButtonPopTracker>(
    createNextButtonPopTracker(
      options.currentEditorStep,
      editorStepGuidanceComplete,
    ),
  )
  const [focusRequestVersion, setFocusRequestVersion] = useState(0)
  const [targetsVersion, setTargetsVersion] = useState(0)
  const activeStepIdRef = useRef<string | undefined>(undefined)

  const activeStep = useMemo(
    () =>
      options.enabled
        ? resolveActiveGuidanceStep(options.steps, options.dismissedHintIds)
        : undefined,
    [options.enabled, options.steps, options.dismissedHintIds],
  )

  activeStepIdRef.current = activeStep?.id

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
    if (!shouldScrollPopForStep(step.id)) return

    const element = targetsRef.current.get(step.id)
    if (!element) return

    queuedStepIdRef.current = null

    const cleanup = runScrollPopSequence({
      element,
      block: scrollBlockForStep(step.id),
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

    return cleanup
  }, [])

  useLayoutEffect(() => {
    const result = planNextButtonPop({
      tracker: nextButtonPopTrackerRef.current,
      enabled: options.enabled,
      editorStep: options.currentEditorStep,
      stepComplete: editorStepGuidanceComplete,
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
    editorStepGuidanceComplete,
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
    return cleanup
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
