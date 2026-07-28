import type { ReactNode } from 'react'
import { useLayoutEffect, useRef } from 'react'
import { cn } from '#/lib/utils.ts'
import type { GuidanceTargetRegister } from './use-guidance-focus.ts'

export interface GuidanceTargetProps {
  stepId: string
  register: GuidanceTargetRegister
  shouldPop?: boolean
  reducedHighlight?: boolean
  onPopAnimationEnd?: (stepId: string) => void
  className?: string
  children: ReactNode
}

/** PROTOTYPE — registers a scroll+pop target for an active guidance step. */
export function GuidanceTarget({
  stepId,
  register,
  shouldPop = false,
  reducedHighlight = false,
  onPopAnimationEnd,
  className,
  children,
}: GuidanceTargetProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    register(stepId, ref.current)
    return () => register(stepId, null)
  }, [register, stepId])

  function handleAnimationEnd(event: React.AnimationEvent<HTMLDivElement>) {
    if (event.animationName !== 'content-route-choice-pop') return
    onPopAnimationEnd?.(stepId)
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
