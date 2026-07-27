import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import type { BillStepCompletion } from '../../../shared/bill-step-completion.ts'
import type { GuidanceStep } from '../../../shared/host-onboarding.ts'
import {
  planGuidanceAutoNavigation,
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
  stepCompletion: BillStepCompletion
  onNavigateToStep: (step: BillStep, options: { resetScroll: boolean }) => void
}

export interface UseGuidanceFocusResult {
  registerTarget: GuidanceTargetRegister
  poppingStepId: string | null
  reducedHighlightStepId: string | null
  activeStepId: string | undefined
  onPopAnimationEnd: (stepId: string) => void
}

export function useGuidanceFocus(
  options: UseGuidanceFocusOptions,
): UseGuidanceFocusResult {
  const targetsRef = useRef(new Map<string, HTMLElement>())
  const [poppingStepId, setPoppingStepId] = useState<string | null>(null)
  const [reducedHighlightStepId, setReducedHighlightStepId] = useState<
    string | null
  >(null)
  const pendingAfterNavStepIdRef = useRef<string | null>(null)
  const lastScrolledStepIdRef = useRef<string | null>(null)

  const activeStep = useMemo(
    () =>
      options.enabled
        ? resolveActiveGuidanceStep(options.steps, options.dismissedHintIds)
        : undefined,
    [options.enabled, options.steps, options.dismissedHintIds],
  )

  const registerTarget: GuidanceTargetRegister = useCallback(
    (stepId, element) => {
      if (element) {
        targetsRef.current.set(stepId, element)
      } else {
        targetsRef.current.delete(stepId)
      }
    },
    [],
  )

  const focusStep = useCallback((step: GuidanceStep) => {
    if (!shouldScrollPopForStep(step.id)) return

    const element = targetsRef.current.get(step.id)
    if (!element) return

    lastScrolledStepIdRef.current = step.id

    const cleanup = runScrollPopSequence({
      element,
      block: scrollBlockForStep(step.id),
      shouldPop: true,
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
    if (!options.enabled || !activeStep) return

    if (!shouldScrollPopForStep(activeStep.id)) {
      pendingAfterNavStepIdRef.current = null
      return
    }

    const navPlan = planGuidanceAutoNavigation({
      activeStep,
      currentEditorStep: options.currentEditorStep,
      stepCompletion: options.stepCompletion,
    })

    if (navPlan.shouldNavigate && navPlan.targetStep !== undefined) {
      pendingAfterNavStepIdRef.current = activeStep.id
      lastScrolledStepIdRef.current = null
      options.onNavigateToStep(navPlan.targetStep as BillStep, {
        resetScroll: navPlan.resetScroll,
      })
      return
    }

    if (activeStep.step !== options.currentEditorStep) {
      return
    }

    const pendingId = pendingAfterNavStepIdRef.current
    if (pendingId !== null && pendingId !== activeStep.id) {
      return
    }
    pendingAfterNavStepIdRef.current = null

    if (lastScrolledStepIdRef.current === activeStep.id) {
      return
    }

    const cleanup = focusStep(activeStep)
    return cleanup
  }, [
    activeStep,
    options.enabled,
    options.currentEditorStep,
    options.stepCompletion,
    options.onNavigateToStep,
    focusStep,
  ])

  const onPopAnimationEnd = useCallback((stepId: string) => {
    setPoppingStepId((current) => (current === stepId ? null : current))
  }, [])

  return {
    registerTarget,
    poppingStepId,
    reducedHighlightStepId,
    activeStepId: activeStep?.id,
    onPopAnimationEnd,
  }
}
