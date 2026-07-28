import { GUIDANCE_FOCUS_TIMING } from './plan-guidance-focus.ts'
import type { GuidanceScrollBlock } from './plan-guidance-focus.ts'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function scrollIntoGuidanceTarget(
  element: HTMLElement,
  block: GuidanceScrollBlock,
): void {
  element.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block,
  })
}

export interface ScrollPopRunOptions {
  element: HTMLElement
  block: GuidanceScrollBlock
  shouldPop: boolean
  onScrollStart?: () => void
  onPopStart?: () => void
}

/** Scroll with settle + retry chain; optionally trigger pop after scroll (#72). */
export function runScrollPopSequence(options: ScrollPopRunOptions): () => void {
  const { element, block, shouldPop, onScrollStart, onPopStart } = options
  const reduced = prefersReducedMotion()

  const scroll = () => {
    onScrollStart?.()
    scrollIntoGuidanceTarget(element, block)
  }

  const retryTimers: number[] = []
  const scrollDelayTimer = window.setTimeout(() => {
    scroll()
    for (const delay of GUIDANCE_FOCUS_TIMING.SCROLL_RETRY_MS) {
      retryTimers.push(window.setTimeout(scroll, delay))
    }
  }, GUIDANCE_FOCUS_TIMING.UI_SETTLE_DELAY_MS)

  const popTimer =
    shouldPop && !reduced
      ? window.setTimeout(
          () => onPopStart?.(),
          GUIDANCE_FOCUS_TIMING.UI_SETTLE_DELAY_MS +
            GUIDANCE_FOCUS_TIMING.POP_AFTER_SCROLL_MS,
        )
      : undefined

  const reducedHighlightTimer =
    shouldPop && reduced
      ? window.setTimeout(
          () => onPopStart?.(),
          GUIDANCE_FOCUS_TIMING.UI_SETTLE_DELAY_MS,
        )
      : undefined

  return () => {
    window.clearTimeout(scrollDelayTimer)
    for (const timer of retryTimers) {
      window.clearTimeout(timer)
    }
    if (popTimer !== undefined) window.clearTimeout(popTimer)
    if (reducedHighlightTimer !== undefined) {
      window.clearTimeout(reducedHighlightTimer)
    }
  }
}
