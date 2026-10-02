/**
 * PROTOTYPE - Direction B primitives: rolling money, buttons, focus layout,
 * screen transitions, quiet bottom sheets. Every motion honors reduced motion.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Dialog } from 'radix-ui'
import { ChevronLeftIcon, MinusIcon, PlusIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { formatEur } from '../mock/store.tsx'

export const STROKE = 1.75
const EASE = [0.16, 1, 0.3, 1] as const

/* ------------------------------------------------------------ money roll */

const CELL = 1.1 // em, per digit cell

function Digit({ d }: { d: number }) {
  const reduce = useReducedMotion()
  return (
    <span
      className="relative inline-block align-baseline"
      style={{ lineHeight: `${CELL}em`, clipPath: 'inset(0)' }}
    >
      <span className="invisible">0</span>
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        initial={false}
        animate={{ y: `${-d * CELL}em` }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: 'spring', stiffness: 210, damping: 26, mass: 0.9 }
        }
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} style={{ height: `${CELL}em` }}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

/** Euro amount whose digits roll on change. The € is set smaller and quieter. */
export function Money({
  cents,
  className,
  euroClassName,
}: {
  cents: number
  className?: string
  euroClassName?: string
}) {
  const abs = Math.abs(Math.round(cents))
  const euros = Math.floor(abs / 100)
  const dec = String(abs % 100).padStart(2, '0')
  const intStr = euros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const chars = [...intStr, ',', ...dec]
  return (
    <span
      className={cn('b-num whitespace-nowrap', className)}
      role="text"
      aria-label={formatEur(cents)}
    >
      {cents < 0 && <span aria-hidden>-</span>}
      {chars.map((c, i) => {
        const key = chars.length - i
        return /\d/.test(c) ? (
          <Digit key={key} d={Number(c)} />
        ) : (
          <span key={`s${key}`} aria-hidden>
            {c}
          </span>
        )
      })}
      <span
        aria-hidden
        className={cn(
          'ml-[0.12em] text-[0.55em] text-(--b-muted)',
          euroClassName,
        )}
      >
        €
      </span>
    </span>
  )
}

/** Plain amount for lists (no roll, still tabular). */
export function Eur({
  cents,
  className,
}: {
  cents: number
  className?: string
}) {
  return (
    <span className={cn('b-num whitespace-nowrap', className)}>
      {formatEur(cents)}
    </span>
  )
}

/* ---------------------------------------------------------------- buttons */

type BtnVariant = 'primary' | 'secondary' | 'quiet' | 'outline'

const BTN: Record<BtnVariant, string> = {
  primary:
    'h-14 w-full rounded-full bg-(--b-accent) px-7 text-[17px] font-semibold text-(--b-accent-ink) disabled:bg-(--b-fill-strong) disabled:text-(--b-muted)',
  secondary:
    'h-14 w-full rounded-full bg-(--b-fill) px-7 text-[17px] font-semibold text-(--b-text) disabled:text-(--b-muted)',
  outline:
    'h-12 rounded-full px-5 text-[16px] font-semibold text-(--b-text) shadow-[inset_0_0_0_1.5px_var(--b-line)] disabled:text-(--b-muted)',
  quiet:
    'h-11 rounded-full px-3 text-[16px] font-medium text-(--b-muted) hover:text-(--b-text) disabled:opacity-50',
}

export function Btn({
  variant = 'primary',
  className,
  children,
  onClick,
  disabled,
  type = 'button',
  ...rest
}: {
  variant?: BtnVariant
  className?: string
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  'aria-label'?: string
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap transition-colors disabled:cursor-not-allowed',
        BTN[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

/** The big round claim control. */
export function RoundBtn({
  kind,
  onClick,
  disabled,
  label,
  size = 'lg',
  soft,
}: {
  kind: 'plus' | 'minus'
  soft?: boolean
  onClick: () => void
  disabled?: boolean
  label: string
  size?: 'lg' | 'md'
}) {
  const Icon = kind === 'plus' ? PlusIcon : MinusIcon
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      className={cn(
        'grid shrink-0 cursor-pointer place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-35',
        size === 'lg' ? 'size-14' : 'size-11',
        kind === 'minus'
          ? 'bg-(--b-fill-strong) text-(--b-text)'
          : soft
            ? 'bg-(--b-accent-soft) text-(--b-accent) hover:bg-(--b-accent) hover:text-(--b-accent-ink)'
            : 'bg-(--b-accent) text-(--b-accent-ink)',
      )}
    >
      <Icon className={size === 'lg' ? 'size-6' : 'size-5'} strokeWidth={2} />
    </motion.button>
  )
}

/* ----------------------------------------------------------------- layout */

export function TopBar({
  onBack,
  backLabel = 'Назад',
  title,
  right,
}: {
  onBack?: () => void
  backLabel?: string
  title?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="flex h-16 items-center justify-between gap-3">
      <div className="flex min-w-11 items-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-3 inline-flex h-11 cursor-pointer items-center gap-1 rounded-full pr-3 pl-2 text-[16px] font-medium text-(--b-muted) hover:text-(--b-text)"
          >
            <ChevronLeftIcon className="size-5" strokeWidth={STROKE} />
            {backLabel}
          </button>
        )}
      </div>
      {title && (
        <div className="min-w-0 truncate text-center text-[15px] font-medium text-(--b-muted)">
          {title}
        </div>
      )}
      <div className="flex min-w-11 items-center justify-end">{right}</div>
    </div>
  )
}

/** Thin 2px progress line pinned to the top of the viewport. */
export function ProgressLine({ value }: { value: number }) {
  const reduce = useReducedMotion()
  return (
    <div className="fixed inset-x-0 top-0 z-20 h-0.5" aria-hidden>
      <motion.div
        className="h-full origin-left bg-(--b-accent)"
        initial={false}
        animate={{ scaleX: Math.max(0.02, Math.min(1, value)) }}
        transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE }}
      />
    </div>
  )
}

/**
 * One focus column. On ≥1024 a dimmed context panel sits beside it; below
 * that breakpoint the context lives behind „Детайли“.
 */
export function FocusLayout({
  children,
  context,
  bottom,
}: {
  children: ReactNode
  context?: ReactNode
  bottom?: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1000px] justify-center gap-20 px-6 sm:px-10">
      <div className="flex min-h-[100dvh] w-full max-w-[460px] flex-col">
        <div className="flex-1 pb-12">{children}</div>
        {bottom && (
          <div className="sticky bottom-0 z-10 -mx-6 bg-[linear-gradient(to_top,var(--b-bg)_calc(100%-2rem),transparent)] px-6 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:-mx-4 sm:px-4">
            {bottom}
          </div>
        )}
      </div>
      {context && (
        <aside className="b-context sticky top-0 hidden h-[100dvh] w-[340px] shrink-0 overflow-y-auto pt-24 pb-12 lg:block">
          {context}
        </aside>
      )}
    </div>
  )
}

/** Cross-fade + 12px slide between screens (fade only under reduced motion). */
export function ScreenSwap({
  id,
  dir = 1,
  children,
}: {
  id: string
  dir?: number
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const dx = reduce ? 0 : 12 * dir
  return (
    <AnimatePresence mode="wait" initial={false} custom={dx}>
      <motion.div
        key={id}
        initial={{ opacity: 0, x: dx }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -dx }}
        transition={{ duration: reduce ? 0.12 : 0.24, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Reveal for progressive disclosure (opacity + small rise). */
export function Reveal({
  show,
  children,
}: {
  show: boolean
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ----------------------------------------------------------------- sheets */

/** Quiet bottom sheet. Portal content carries `.proto-b` so tokens apply. */
export function BSheet({
  open,
  onOpenChange,
  title,
  children,
  tall,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  tall?: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="proto-b fixed inset-0 z-50 bg-[oklch(0.2_0.01_165/0.38)]! backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'proto-b fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[540px] flex-col rounded-t-[28px] bg-(--b-surface)! shadow-(--b-lift) outline-none sm:bottom-6 sm:rounded-[28px]',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom motion-reduce:animate-none',
            tall ? 'h-[88dvh] sm:h-[80dvh]' : 'max-h-[88dvh]',
          )}
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-(--b-fill-strong) sm:hidden" />
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <Dialog.Title className="text-[22px] font-semibold tracking-[-0.01em]">
              {title}
            </Dialog.Title>
            <Dialog.Close className="-mr-2 h-10 cursor-pointer rounded-full px-3 text-[15px] font-medium text-(--b-muted) hover:text-(--b-text)">
              Затвори
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ----------------------------------------------------------------- bits */

export function Skel({ className }: { className?: string }) {
  return <div className={cn('b-skel h-4', className)} />
}

export type StateTone =
  'paid' | 'pending' | 'choosing' | 'idle' | 'owes' | 'host'

/** One state word per person. Pending is ink with a thin ring, not a hue. */
export function StateWord({
  tone,
  children,
}: {
  tone: StateTone
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full text-[15px] leading-none whitespace-nowrap',
        tone === 'paid' && 'font-semibold text-(--b-accent)',
        tone === 'pending' &&
          'px-2.5 py-1.5 font-semibold text-(--b-text) shadow-[inset_0_0_0_1.5px_var(--b-text)]',
        tone === 'choosing' && 'text-(--b-text)',
        tone === 'owes' && 'text-(--b-text)',
        tone === 'idle' && 'text-(--b-muted)',
        tone === 'host' && 'text-(--b-muted)',
      )}
    >
      {children}
    </span>
  )
}

/** Copy to clipboard with a short-lived confirmation flag. */
export function useCopy(): [
  string | null,
  (key: string, text: string) => void,
] {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = useCallback((key: string, text: string) => {
    try {
      void navigator.clipboard.writeText(text).catch(() => undefined)
    } catch {
      // Clipboard can be missing in insecure contexts; the flag still confirms.
    }
    setCopied(key)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(null), 2200)
  }, [])
  return [copied, copy]
}

export function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}
