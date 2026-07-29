import type { BillStepNumber } from './bill-step-completion'
import type { GuidanceStep, HostOnboardingBillContext } from './host-onboarding'
import {
  currentGuidanceStep,
  deriveHostOnboardingGuidance,
  guidanceForEditorStep,
  isEditorStepGuidanceComplete,
  stepBarGuidanceLabel,
} from './host-onboarding'

/** Steps that show guidance copy only — no scroll+pop target (#68). */
export const GUIDANCE_STEPS_WITHOUT_SCROLL_POP = new Set(['scan-processing'])

export type GuidanceScrollBlock = ScrollLogicalPosition

export const GUIDANCE_SCROLL_BLOCKS: Record<string, GuidanceScrollBlock> = {
  'content-route': 'center',
  'scan-upload': 'center',
  'scan-run-ocr': 'center',
  'scan-review': 'center',
  restaurant: 'start',
  participants: 'center',
  allocation: 'center',
  share: 'center',
  review: 'center',
}

export function shouldScrollPopForStep(stepId: string): boolean {
  return !GUIDANCE_STEPS_WITHOUT_SCROLL_POP.has(stepId)
}

export function scrollBlockForStep(stepId: string): GuidanceScrollBlock {
  return GUIDANCE_SCROLL_BLOCKS[stepId] ?? 'center'
}

export const GUIDANCE_FOCUS_TIMING = {
  UI_SETTLE_DELAY_MS: 800,
  POP_AFTER_SCROLL_MS: 550,
  SCROLL_RETRY_MS: [120, 350] as const,
  /** Bottom sheet close is 300ms — wait for it before next-button pop. */
  SHEET_CLOSE_SETTLE_MS: 350,
  /** Pause after step guidance completes before popping „Напред“. */
  NEXT_BUTTON_POP_DELAY_MS: 800,
} as const

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

export interface ComputeGuidanceStateInput {
  bill: HostOnboardingBillContext
  dismissedHintIds: string[]
  editorStep: BillStepNumber
  stepLabels: readonly string[]
}

export interface GuidanceState {
  steps: GuidanceStep[]
  dismissedHintIds: string[]
  activeStep: GuidanceStep | undefined
  editorStepGuidance: GuidanceStep | undefined
  stepBarLabel: ReturnType<typeof stepBarGuidanceLabel>
  editorStepGuidanceComplete: boolean
}

/** Single entry for Напътствия curriculum, active step, and step-bar signal. */
export function computeGuidanceState(
  input: ComputeGuidanceStateInput,
): GuidanceState {
  const steps = deriveHostOnboardingGuidance({
    bill: input.bill,
    dismissedHintIds: input.dismissedHintIds,
  })
  const { dismissedHintIds, editorStep, stepLabels } = input

  return {
    steps,
    dismissedHintIds,
    activeStep: currentGuidanceStep(steps, dismissedHintIds),
    editorStepGuidance: guidanceForEditorStep(
      steps,
      editorStep,
      dismissedHintIds,
    ),
    stepBarLabel: stepBarGuidanceLabel({
      steps,
      currentStep: editorStep,
      dismissedHintIds,
      stepLabels,
    }),
    editorStepGuidanceComplete: isEditorStepGuidanceComplete(
      steps,
      editorStep,
      dismissedHintIds,
    ),
  }
}

export function focusPlanForStep(step: GuidanceStep | undefined): {
  shouldScrollPop: boolean
  scrollBlock: GuidanceScrollBlock
} {
  if (!step) {
    return { shouldScrollPop: false, scrollBlock: 'center' }
  }
  return {
    shouldScrollPop: shouldScrollPopForStep(step.id),
    scrollBlock: scrollBlockForStep(step.id),
  }
}
