import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Motion's JS animations skip the CSS prefers-reduced-motion rule, so every
 * page that animates with `motion/react` renders under this config. It wraps
 * the animating routes (not the root) so the motion runtime loads with their
 * chunks instead of with the entry bundle.
 */
export function withReducedMotion(Page: () => ReactNode): () => ReactNode {
  function WithReducedMotion() {
    return (
      <MotionConfig reducedMotion="user">
        <Page />
      </MotionConfig>
    )
  }
  return WithReducedMotion
}
