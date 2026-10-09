import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { cn } from '#/lib/utils.ts'

const STORAGE_KEY = 'onova-dock-collapsed'
const listeners = new Set<() => void>()
// Stands in for storage when the browser blocks it, so folding still works.
let fallback = false

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return fallback
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

/**
 * Whether the phone dock is folded. One remembered choice for every bill,
 * host or guest; the server render (and a browser without storage) starts
 * the dock open.
 */
export function useDockCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false)
  function toggle() {
    fallback = !collapsed
    try {
      localStorage.setItem(STORAGE_KEY, fallback ? '1' : '0')
    } catch {
      // Storage blocked: `fallback` keeps the choice for this visit.
    }
    for (const listener of listeners) listener()
  }
  return [collapsed, toggle] as const
}

/**
 * The grip on top of a phone's bottom dock: folds the dock down to this
 * handle to free the screen, and back up. Hidden from md up, where the
 * dock's content sits in a column instead.
 */
export function DockHandle({
  collapsed,
  onToggle,
  label,
  className,
}: {
  collapsed: boolean
  onToggle: () => void
  /** What the folded dock holds — shown on the handle while it is folded. */
  label: string
  className?: string
}) {
  return (
    <div className={cn('flex justify-center md:hidden', className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Покажи: ${label}` : `Скрий: ${label}`}
        className={cn(
          "relative flex h-8 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium text-ink-muted transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          collapsed && 'border border-rule bg-paper shadow-sm',
        )}
      >
        {collapsed ? (
          <>
            <ChevronUpIcon className="size-4" aria-hidden />
            {label}
          </>
        ) : (
          <ChevronDownIcon className="size-4" aria-hidden />
        )}
      </button>
    </div>
  )
}
