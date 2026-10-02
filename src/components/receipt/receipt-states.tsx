import type { ReactNode } from 'react'
import { Receipt, Rule } from '#/components/receipt/paper.tsx'

/** A receipt still printing: skeleton lines in the shape of the content. */
export function ReceiptLoading({ lines = 6 }: { lines?: number }) {
  return (
    <div
      className="mx-auto w-full max-w-[480px] px-3 pt-4 pb-24 sm:pt-10"
      role="status"
      aria-label="Зареждане"
    >
      <Receipt>
        <div className="skeleton-print h-3 w-32" />
        <div className="skeleton-print mt-3 h-7 w-3/4" />
        <Rule />
        <div className="space-y-4 py-1">
          {Array.from({ length: lines }, (_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-3">
                <div
                  className="skeleton-print h-3.5"
                  style={{ width: `${45 + ((index * 17) % 35)}%` }}
                />
                <div className="flex-1" />
                <div className="skeleton-print h-3.5 w-14" />
              </div>
              <div className="skeleton-print h-2.5 w-20" />
            </div>
          ))}
        </div>
      </Receipt>
    </div>
  )
}

/** A short printed note on paper: invalid link, nothing here, and so on. */
export function ReceiptMessage({
  title,
  children,
  action,
}: {
  title?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-[480px] px-3 pt-6 pb-24 sm:pt-12">
      <Receipt>
        {title ? (
          <h2 className="font-display text-[20px] font-bold">{title}</h2>
        ) : null}
        <div className="mt-2 text-[13px] leading-relaxed">{children}</div>
        {action ? <div className="mt-4">{action}</div> : null}
      </Receipt>
    </div>
  )
}
