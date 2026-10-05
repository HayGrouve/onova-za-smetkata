import type { ReactNode } from 'react'

/** Title and one line of help, on the table above the paper. */
export function QuickPageHeader({
  title,
  hint,
  children,
}: {
  title: ReactNode
  hint?: ReactNode
  children?: ReactNode
}) {
  return (
    <header>
      <h1 className="font-display text-[24px] leading-tight font-bold sm:text-[28px]">
        {title}
      </h1>
      {hint ? (
        <p className="mt-1.5 max-w-[42ch] text-[12px] leading-relaxed text-on-table-muted">
          {hint}
        </p>
      ) : null}
      {children}
    </header>
  )
}

/** Pinned to the bottom of the phone: the step's one main action. */
export function QuickActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-background from-60% to-transparent pt-6">
      <div className="mx-auto w-full max-w-[480px] px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  )
}
