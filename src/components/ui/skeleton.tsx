import { cn } from '#/lib/utils.ts'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('skeleton-print rounded-none', className)} aria-hidden />
  )
}
