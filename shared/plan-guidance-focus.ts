import type { GuidanceStep } from './host-onboarding.ts'
import { currentGuidanceStep } from './host-onboarding.ts'

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

export const GUIDANCE_FOCUS_TIMING = {
  UI_SETTLE_DELAY_MS: 800,
  POP_AFTER_SCROLL_MS: 550,
  SCROLL_RETRY_MS: [120, 350] as const,
  /** Bottom sheet close is 300ms — wait for it before next-button pop. */
  SHEET_CLOSE_SETTLE_MS: 350,
} as const
