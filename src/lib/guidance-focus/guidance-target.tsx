import type { ReactNode } from 'react'
import { useLayoutEffect, useRef } from 'react'
import { cn } from '#/lib/utils.ts'
import type { GuidanceFocusHandle } from './use-guidance-focus.ts'

export interface GuidanceTargetProps {
  stepId: string
  focus: GuidanceFocusHandle
  className?: string
  children: ReactNode
}

/** Registers a scroll+pop target for an active guidance step. */
export function GuidanceTarget({
  stepId,
  focus,
  className,
  children,
}: GuidanceTargetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const shouldPop = focus.poppingStepId === stepId
  const reducedHighlight = focus.reducedHighlightStepId === stepId

  useLayoutEffect(() => {
    focus.registerTarget(stepId, ref.current)
    return () => focus.registerTarget(stepId, null)
  }, [focus.registerTarget, stepId])

  function handleAnimationEnd(event: React.AnimationEvent<HTMLDivElement>) {
    if (event.animationName !== 'content-route-choice-pop') return
    focus.onPopAnimationEnd(stepId)
  }

  return (
    <div
      ref={ref}
      data-guidance-target={stepId}
      className={cn(
        'scroll-mt-24 origin-center',
        shouldPop && 'content-route-choice-pop',
        reducedHighlight &&
          'rounded-lg outline-2 outline-offset-2 outline-primary',
        className,
      )}
      onAnimationEnd={shouldPop ? handleAnimationEnd : undefined}
    >
      {children}
    </div>
  )
}
