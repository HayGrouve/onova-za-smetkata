import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils.ts'

/**
 * A rubber stamp that thuds onto the paper. `paid` is vermilion double-ruled
 * (ПЛАТЕНО, ПРИКЛЮЧЕНА); `wait` is dashed ink (ЧАКА, ЧЕРНОВА).
 */
export function Stamp({
  kind = 'paid',
  children,
  className,
  thud = true,
}: {
  kind?: 'paid' | 'wait'
  children: ReactNode
  className?: string
  /** Animate the stamp landing. Off for stamps that were already there. */
  thud?: boolean
}) {
  return (
    <motion.span
      initial={thud ? { scale: 1.5, rotate: -16, opacity: 0 } : false}
      animate={{ scale: 1, rotate: 0, opacity: 0.92 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 520, damping: 22, mass: 0.8 }}
      className={cn('stamp', kind === 'wait' && 'stamp-wait', className)}
    >
      {children}
    </motion.span>
  )
}
