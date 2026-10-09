import { Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Mounts a code-split sheet from the first time it is opened. The sheet stays
 * mounted afterwards, so its close animation and the focus return still run.
 * It opens straight into its enter animation once the chunk has arrived.
 */
export function MountOnFirstOpen({
  open,
  children,
}: {
  open: boolean
  children: ReactNode
}) {
  const [opened, setOpened] = useState(open)
  if (open && !opened) setOpened(true)
  return opened ? <Suspense fallback={null}>{children}</Suspense> : null
}

/**
 * Fetches sheet chunks once the browser is idle so a Host's first tap does not
 * wait on the network. Does nothing while `enabled` is false (Guests and
 * signed-out visitors never open these sheets).
 */
export function usePreloadWhenIdle(
  enabled: boolean,
  loaders: ReadonlyArray<() => Promise<unknown>>,
) {
  useEffect(() => {
    if (!enabled) return
    const run = () => {
      for (const load of loaders) void load().catch(() => {})
    }
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 4000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(run, 2000)
    return () => clearTimeout(id)
  }, [enabled, loaders])
}
