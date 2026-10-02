import type { ReactNode } from 'react'
import { formatEur } from '#/lib/format-currency.ts'
import { cn } from '#/lib/utils.ts'

/**
 * A receipt on the table: zig-zag top edge, thermal texture, drop shadow.
 * `open` leaves the bottom edge for slips that continue below; otherwise the
 * paper closes with a zig-zag.
 */
export function Receipt({
  children,
  footer,
  className,
  innerClassName,
}: {
  children: ReactNode
  /** Rendered below the paper body, still on the same strip (slips, stubs). */
  footer?: ReactNode
  className?: string
  innerClassName?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <div className="paper-shadow">
        <div
          className={cn(
            'paper paper-top thermal relative px-4 pb-4 sm:px-6',
            innerClassName,
          )}
        >
          {children}
        </div>
        {footer ? <div className="paper">{footer}</div> : null}
        <div className="paper-end" aria-hidden />
      </div>
    </div>
  )
}

export function Rule({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rule my-3', className)} />
}

/** „Name ........ value“ on paper. */
export function LeaderRow({
  label,
  value,
  className,
  strong,
}: {
  label: ReactNode
  value: ReactNode
  className?: string
  strong?: boolean
}) {
  return (
    <div className={cn('flex items-baseline', className)}>
      <span className="min-w-0">{label}</span>
      <span className="leader" aria-hidden />
      <span className={cn('shrink-0 money', strong && 'font-bold')}>
        {value}
      </span>
    </div>
  )
}

const receiptDate = new Intl.DateTimeFormat('bg-BG', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Sofia',
})

export function formatReceiptDate(ms: number): string {
  return receiptDate.format(new Date(ms)).replace(' г.', '').replace(',', '')
}

/** Date line, title and whatever sits under it (link stub, chips). */
export function ReceiptHeader({
  date,
  right,
  title,
  children,
}: {
  date: number
  right?: ReactNode
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="pb-1">
      <div className="flex items-baseline justify-between gap-3 text-[11px] text-ink-muted">
        <span suppressHydrationWarning>{formatReceiptDate(date)}</span>
        {right ? <span className="min-w-0 truncate">{right}</span> : null}
      </div>
      <div className="mt-2">{title}</div>
      {children}
    </header>
  )
}

export function RestaurantTitle({
  name,
  as: Tag = 'h2',
}: {
  name: string
  as?: 'h2' | 'p'
}) {
  const trimmed = name.trim()
  return (
    <Tag
      className={cn(
        'font-display text-[22px] leading-[1.1] font-bold tracking-[-0.01em] text-ink uppercase sm:text-[26px]',
        !trimmed && 'text-ink-muted italic',
      )}
    >
      {trimmed || 'Без име'}
    </Tag>
  )
}

/** Perforation before a tear-off slip. */
export function Perforation({ className }: { className?: string }) {
  return <div aria-hidden className={cn('perf', className)} />
}

/** Сума на редовете, бакшиш, общо. Extra rows go between tip and total. */
export function ReceiptTotals({
  subtotalCents,
  tipCents,
  children,
}: {
  subtotalCents: number
  tipCents: number
  children?: ReactNode
}) {
  const tipPercent =
    subtotalCents > 0 ? Math.round((tipCents / subtotalCents) * 100) : 0
  return (
    <div className="space-y-1 text-[12px]">
      <LeaderRow label="Сума на редовете" value={formatEur(subtotalCents)} />
      {tipCents > 0 ? (
        <LeaderRow
          label={tipPercent > 0 ? `Бакшиш ${tipPercent}%` : 'Бакшиш'}
          value={formatEur(tipCents)}
        />
      ) : null}
      {children}
      <div className="flex items-baseline pt-2">
        <span className="font-display text-[15px] font-bold uppercase">
          Общо
        </span>
        <span className="leader" aria-hidden />
        <span className="font-display text-[22px] font-bold">
          {formatEur(subtotalCents + tipCents)}
        </span>
      </div>
    </div>
  )
}
