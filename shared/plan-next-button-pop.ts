import type { BillStepNumber } from './bill-step-completion.ts'

export interface NextButtonPopTracker {
  initialized: boolean
  editorStep: BillStepNumber
  stepComplete: boolean
  blocked: boolean
  pendingPop: boolean
  poppedForStep: BillStepNumber | null
}

export function createNextButtonPopTracker(
  editorStep: BillStepNumber,
  stepComplete: boolean,
): NextButtonPopTracker {
  return {
    initialized: false,
    editorStep,
    stepComplete,
    blocked: false,
    pendingPop: false,
    poppedForStep: stepComplete ? editorStep : null,
  }
}

export interface PlanNextButtonPopInput {
  tracker: NextButtonPopTracker
  enabled: boolean
  editorStep: BillStepNumber
  stepComplete: boolean
  blocked: boolean
  canShow: boolean
}

export interface PlanNextButtonPopResult {
  tracker: NextButtonPopTracker
  triggerPop: boolean
  clearPop: boolean
}

/** Decide whether to pop the step nav „Напред“ button after a step completes. */
export function planNextButtonPop(
  input: PlanNextButtonPopInput,
): PlanNextButtonPopResult {
  const { enabled, editorStep, stepComplete, blocked, canShow } = input
  const tracker = { ...input.tracker }

  if (!enabled) {
    return {
      tracker: input.tracker,
      triggerPop: false,
      clearPop: true,
    }
  }

  if (!tracker.initialized) {
    tracker.initialized = true
    tracker.editorStep = editorStep
    tracker.stepComplete = stepComplete
    tracker.blocked = blocked
    tracker.pendingPop = false
    tracker.poppedForStep = stepComplete ? editorStep : null
    return { tracker, triggerPop: false, clearPop: false }
  }

  if (tracker.editorStep !== editorStep) {
    tracker.editorStep = editorStep
    tracker.stepComplete = stepComplete
    tracker.blocked = blocked
    tracker.pendingPop = false
    tracker.poppedForStep = stepComplete ? editorStep : null
    return { tracker, triggerPop: false, clearPop: true }
  }

  const justCompleted = !tracker.stepComplete && stepComplete
  const unblockedWhileComplete = tracker.blocked && !blocked && stepComplete

  if (justCompleted && editorStep < 4) {
    tracker.pendingPop = true
  } else if (unblockedWhileComplete && editorStep < 4) {
    tracker.pendingPop = true
  }

  tracker.stepComplete = stepComplete
  tracker.blocked = blocked

  if (
    tracker.pendingPop &&
    canShow &&
    !blocked &&
    tracker.poppedForStep !== editorStep
  ) {
    tracker.pendingPop = false
    tracker.poppedForStep = editorStep
    return { tracker, triggerPop: true, clearPop: false }
  }

  return { tracker, triggerPop: false, clearPop: false }
}
