import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'

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
          'flex h-8 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium text-ink-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
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
