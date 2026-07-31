import { useMemo } from 'react'

/** Stable-enough clock for Convex queries that must not call Date.now() server-side. */
export function useViewerNowMs(): number {
  return useMemo(() => Date.now(), [])
}
