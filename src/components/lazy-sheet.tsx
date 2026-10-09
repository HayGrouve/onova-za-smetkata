import {
  Component,
  Suspense,
  createContext,
  use,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ComponentType, ReactNode } from 'react'
import { toast } from 'sonner'

const SHEET_LOAD_FAILED = 'Неуспешно зареждане. Обновете страницата.'

/** Which open of a MountOnFirstOpen is rendering: a failed load retries on the next. */
const SheetAttemptContext = createContext(0)

/**
 * A sheet whose code loads on first use. Unlike `React.lazy`, a failed load
 * (offline, or a tab left open across a deploy whose old chunk is gone) is
 * not remembered for good: the next open of its MountOnFirstOpen, or the next
 * `preload()`, fetches again. Within one open the failure sticks, so React's
 * own re-renders surface it instead of looping.
 */
export function lazySheet<TProps extends object>(
  load: () => Promise<ComponentType<TProps>>,
): { Sheet: ComponentType<TProps>; preload: () => Promise<unknown> } {
  let pending: Promise<ComponentType<TProps>> | undefined
  let rejected = false
  let owner: unknown
  const get = (attempt: unknown) => {
    if (pending && rejected && owner !== attempt) pending = undefined
    if (!pending) {
      owner = attempt
      rejected = false
      const current: Promise<ComponentType<TProps>> = load().catch(
        (error: unknown) => {
          if (pending === current) rejected = true
          throw error
        },
      )
      pending = current
    }
    return pending
  }
  function LazySheet(props: TProps) {
    const Sheet = use(get(useContext(SheetAttemptContext)))
    return <Sheet {...props} />
  }
  // Every preload is its own attempt.
  return { Sheet: LazySheet, preload: () => get({}) }
}

class SheetLoadBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    toast.error(SHEET_LOAD_FAILED)
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Mounts a code-split sheet from the first time it is opened. The sheet stays
 * mounted afterwards, so its close animation and the focus return still run.
 * It opens straight into its enter animation once the chunk has arrived.
 *
 * If the sheet cannot load, the page stays as it is: a toast says so and
 * `onClose` resets the opener, so the next open tries again. Without
 * `onClose` the sheet stays away until `open` turns false.
 */
export function MountOnFirstOpen({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose?: () => void
  children: ReactNode
}) {
  const [opened, setOpened] = useState(open)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  if (!open && failed) setFailed(false)
  if (open && !opened && !failed) setOpened(true)
  if (!opened) return null
  return (
    <SheetLoadBoundary
      onError={() => {
        setOpened(false)
        setFailed(true)
        setAttempt((value) => value + 1)
        onClose?.()
      }}
    >
      <SheetAttemptContext value={attempt}>
        <Suspense fallback={null}>{children}</Suspense>
      </SheetAttemptContext>
    </SheetLoadBoundary>
  )
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
