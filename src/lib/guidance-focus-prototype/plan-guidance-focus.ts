import type { BillStepCompletion } from '../../../shared/bill-step-completion.ts'
import type { GuidanceStep } from '../../../shared/host-onboarding.ts'
import { currentGuidanceStep } from '../../../shared/host-onboarding.ts'

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
}

export function shouldScrollPopForStep(stepId: string): boolean {
  return !GUIDANCE_STEPS_WITHOUT_SCROLL_POP.has(stepId)
}

export function resolveActiveGuidanceStep(
  steps: GuidanceStep[],
  dismissedHintIds: string[],
): GuidanceStep | undefined {
  return currentGuidanceStep(steps, dismissedHintIds)
}

export function scrollBlockForStep(stepId: string): GuidanceScrollBlock {
  return GUIDANCE_SCROLL_BLOCKS[stepId] ?? 'center'
}

/** Forward-only auto-nav gated by step completion (#69). */
export function planGuidanceAutoNavigation(input: {
  activeStep: GuidanceStep
  currentEditorStep: number
  stepCompletion: BillStepCompletion
}): { shouldNavigate: boolean; targetStep?: number; resetScroll: boolean } {
  const { activeStep, currentEditorStep, stepCompletion } = input

  if (activeStep.step === currentEditorStep) {
    return { shouldNavigate: false, resetScroll: false }
  }

  if (activeStep.step < currentEditorStep) {
    return { shouldNavigate: false, resetScroll: false }
  }

  const currentComplete =
    stepCompletion[currentEditorStep as keyof BillStepCompletion]
  if (!currentComplete) {
    return { shouldNavigate: false, resetScroll: false }
  }

  return {
    shouldNavigate: true,
    targetStep: activeStep.step,
    resetScroll: false,
  }
}

export const GUIDANCE_FOCUS_TIMING = {
  UI_SETTLE_DELAY_MS: 800,
  POP_AFTER_SCROLL_MS: 550,
  SCROLL_RETRY_MS: [120, 350] as const,
} as const
