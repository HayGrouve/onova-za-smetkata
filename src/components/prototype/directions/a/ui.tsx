/** PROTOTYPE — Direction A primitives: grouped lists, pills, steppers, sheets. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MinusIcon, MoreHorizontalIcon, PlusIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { formatEur } from '../mock/store.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'

export const STROKE = 1.75

/* ---------------------------------------------------------------- money */

export function Money({
  cents,
  className,
}: {
  cents: number
  className?: string
}) {
  return (
    <span className={cn('tabular-nums whitespace-nowrap', className)}>
      {formatEur(cents)}
    </span>
  )
}

/* --------------------------------------------------------------- avatar */

export function Avatar({
  name,
  size = 32,
  me,
  muted,
  className,
}: {
  name: string
  size?: number
  me?: boolean
  muted?: boolean
  className?: string
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none',
        me
          ? 'bg-(--a-accent-soft) text-(--a-accent)'
          : 'bg-(--a-surface-2) text-(--a-text)',
        muted && 'opacity-55',
        className,
      )}
    >
      {initial}
    </span>
  )
}

export function AvatarStack({
  names,
  max = 4,
  size = 22,
  meName,
}: {
  names: string[]
  max?: number
  size?: number
  meName?: string
}) {
  const shown = names.slice(0, max)
  const extra = names.length - shown.length
  return (
    <span className="inline-flex items-center">
      {shown.map((n, i) => (
        <Avatar
          key={`${n}-${i}`}
          name={n}
          size={size}
          me={n === meName}
          className={cn('ring-2 ring-(--a-surface)', i > 0 && '-ml-1.5')}
        />
      ))}
      {extra > 0 && (
        <span className="-ml-1.5 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-(--a-surface-2) px-1 text-[11px] font-semibold text-(--a-muted) ring-2 ring-(--a-surface)">
          +{extra}
        </span>
      )}
    </span>
  )
}

/* ---------------------------------------------------------------- pills */

export type PillTone = 'paid' | 'pending' | 'due' | 'neutral' | 'accent'

const PILL: Record<PillTone, string> = {
  paid: 'bg-[color-mix(in_oklch,var(--a-paid)_13%,transparent)] text-(--a-paid)',
  pending:
    'bg-[color-mix(in_oklch,var(--a-pending-strong)_18%,transparent)] text-(--a-pending)',
  due: 'bg-(--a-surface-2) text-(--a-text)',
  neutral: 'bg-(--a-surface-2) text-(--a-muted)',
  accent: 'bg-(--a-accent-soft) text-(--a-accent)',
}

export function Pill({
  tone,
  children,
  dot,
  className,
}: {
  tone: PillTone
  children: ReactNode
  /** Only for real state (paid, pending, joined). */
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold leading-none whitespace-nowrap',
        PILL[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------- buttons */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
type BtnSize = 'lg' | 'md' | 'sm'

const BTN_V: Record<BtnVariant, string> = {
  primary: 'bg-(--a-accent) text-(--a-on-accent) hover:brightness-[1.06]',
  secondary:
    'bg-(--a-surface-2) text-(--a-text) hover:bg-[color-mix(in_oklch,var(--a-surface-2)_80%,var(--a-text)_6%)]',
  ghost: 'text-(--a-accent) hover:bg-(--a-accent-soft)',
  quiet: 'text-(--a-text) hover:bg-(--a-surface-2)',
  danger:
    'text-(--a-danger) hover:bg-[color-mix(in_oklch,var(--a-danger)_8%,transparent)]',
}
const BTN_S: Record<BtnSize, string> = {
  lg: 'h-12 px-5 text-[16px]',
  md: 'h-10 px-4 text-[15px]',
  sm: 'h-8 px-3 text-[13px]',
}

export function Btn({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] font-semibold whitespace-nowrap transition-[background-color,filter,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-(--ring) active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[18px] [&_svg]:shrink-0',
        BTN_V[variant],
        BTN_S[size],
        className,
      )}
    />
  )
}

export function IconBtn({
  label,
  className,
  children,
  ...props
}: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] text-(--a-text) transition-colors outline-none hover:bg-(--a-surface-2) focus-visible:ring-2 focus-visible:ring-(--ring) disabled:opacity-40 [&_svg]:size-5',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------- grouped lists */

export function Group({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[14px] border border-(--a-hairline) bg-(--a-surface) [&>*+*]:border-t [&>*+*]:border-(--a-hairline)',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function GroupLabel({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-8 items-end justify-between gap-3 px-1 pb-2',
        className,
      )}
    >
      <h3 className="text-[13px] font-medium text-(--a-muted)">{children}</h3>
      {action}
    </div>
  )
}

/* -------------------------------------------------------------- stepper */

export function Stepper({
  value,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  label,
  size = 'md',
}: {
  value: number
  onDec: () => void
  onInc: () => void
  decDisabled?: boolean
  incDisabled?: boolean
  label: string
  size?: 'md' | 'sm'
}) {
  const btn =
    'inline-flex items-center justify-center rounded-[8px] text-(--a-text) transition-colors outline-none hover:bg-(--a-surface) focus-visible:ring-2 focus-visible:ring-(--ring) active:scale-95 disabled:opacity-35 disabled:hover:bg-transparent'
  const s = size === 'md' ? 'size-9' : 'size-8'
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center rounded-[10px] bg-(--a-surface-2) p-0.5',
        value > 0 && 'bg-(--a-accent-soft)',
      )}
    >
      <button
        type="button"
        className={cn(btn, s)}
        onClick={onDec}
        disabled={decDisabled || value === 0}
        aria-label={`Махни една, ${label}`}
      >
        <MinusIcon className="size-4" strokeWidth={2} />
      </button>
      <span
        aria-live="polite"
        className={cn(
          'min-w-7 text-center text-[15px] font-semibold tabular-nums',
          value > 0 ? 'text-(--a-accent)' : 'text-(--a-muted)',
        )}
      >
        {value}
      </span>
      <button
        type="button"
        className={cn(btn, s)}
        onClick={onInc}
        disabled={incDisabled}
        aria-label={`Добави една, ${label}`}
      >
        <PlusIcon className="size-4" strokeWidth={2} />
      </button>
    </div>
  )
}

/* --------------------------------------------------------------- meter */

/** A fill on a hairline. No track. */
export function Meter({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      className={cn('relative h-[3px]', className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-(--a-hairline)" />
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-(--a-accent) transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------------- segmented */

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  layoutId,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; badge?: number }>
  layoutId: string
}) {
  const reduce = useReducedMotion()
  return (
    <div role="tablist" className="flex gap-1 border-b border-(--a-hairline)">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex h-11 flex-1 items-center justify-center gap-1.5 text-[15px] font-semibold transition-colors outline-none focus-visible:bg-(--a-surface-2) md:flex-none md:px-4',
              active
                ? 'text-(--a-text)'
                : 'text-(--a-muted) hover:text-(--a-text)',
            )}
          >
            {o.label}
            {o.badge ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-(--a-pending-strong) px-1.5 text-[11px] font-bold text-[oklch(0.22_0.03_70)] tabular-nums">
                {o.badge}
              </span>
            ) : null}
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 520, damping: 42 }
                }
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-(--a-accent)"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex rounded-[10px] bg-(--a-surface-2) p-0.5',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 flex-1 rounded-[8px] px-3 text-[13px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-(--ring)',
            o.value === value
              ? 'bg-(--a-surface) text-(--a-text) shadow-[0_1px_2px_oklch(0.24_0.01_260/0.1)]'
              : 'text-(--a-muted) hover:text-(--a-text)',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------- chip */

export function Chip({
  selected,
  className,
  children,
  ...props
}: ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-(--ring) active:scale-[0.98] disabled:opacity-40 [&_svg]:size-4',
        selected
          ? 'border-(--a-accent) bg-(--a-accent-soft) text-(--a-accent)'
          : 'border-(--a-hairline) bg-(--a-surface) text-(--a-text) hover:bg-(--a-surface-2)',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- field */

export function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string
  error?: string | null
  hint?: string
  htmlFor: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-medium text-(--a-muted)"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-err`}
          className="text-[13px] font-medium text-(--a-danger)"
        >
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-(--a-muted)">{hint}</p>
      ) : null}
    </div>
  )
}

export function TextInput({
  invalid,
  className,
  ...props
}: ComponentProps<'input'> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && props.id ? `${props.id}-err` : undefined}
      className={cn(
        'h-11 w-full min-w-0 rounded-[10px] border bg-(--a-surface) px-3 text-[16px] text-(--a-text) outline-none transition-colors placeholder:text-(--a-muted) focus:border-(--a-accent) focus:ring-3 focus:ring-(--ring)',
        invalid ? 'border-(--a-danger)' : 'border-(--a-field)',
        className,
      )}
    />
  )
}

/* ------------------------------------------------------------ skeleton */

export function Skel({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-[6px] bg-(--a-surface-2) motion-safe:animate-pulse',
        className,
      )}
    />
  )
}

/* --------------------------------------------------------------- sheet */

export function ASheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  headerAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  headerAction?: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="proto-a mx-auto max-h-[88dvh] gap-0 rounded-t-[14px] border-0 bg-(--a-surface) p-0 shadow-(--a-sheet-shadow) motion-reduce:animate-none sm:max-w-lg md:bottom-6 md:rounded-[14px]"
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-(--a-hairline) md:hidden" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-3 md:pt-5">
          <div className="min-w-0">
            <SheetTitle className="text-[17px] font-semibold tracking-[-0.01em] text-(--a-text)">
              {title}
            </SheetTitle>
            {description ? (
              <SheetDescription className="mt-0.5 text-[13px] text-(--a-muted)">
                {description}
              </SheetDescription>
            ) : (
              <SheetDescription className="sr-only">
                {typeof title === 'string' ? title : ''}
              </SheetDescription>
            )}
          </div>
          {headerAction}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {children}
        </div>
        {footer && (
          <div className="border-t border-(--a-hairline) px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* -------------------------------------------------------------- confirm */

export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  children,
  tone = 'primary',
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  children?: ReactNode
  tone?: 'primary' | 'danger'
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="proto-a gap-0 rounded-[14px] border-(--a-hairline) bg-(--a-surface) p-5 sm:max-w-sm">
        <AlertDialogTitle className="text-[17px] font-semibold tracking-[-0.01em]">
          {title}
        </AlertDialogTitle>
        <AlertDialogDescription className="mt-1.5 text-[15px] leading-snug text-(--a-muted)">
          {description}
        </AlertDialogDescription>
        {children}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Btn variant="secondary" onClick={() => onOpenChange(false)}>
            Отказ
          </Btn>
          <Btn
            variant="primary"
            className={
              tone === 'danger'
                ? 'bg-(--a-danger) text-(--a-on-accent)'
                : undefined
            }
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Btn>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ----------------------------------------------------------------- menu */

export function RowMenu({
  label,
  items,
}: {
  label: string
  items: Array<{
    label: string
    onSelect: () => void
    danger?: boolean
    icon?: ReactNode
    disabled?: boolean
  }>
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconBtn label={label} className="size-9 text-(--a-muted)">
          <MoreHorizontalIcon strokeWidth={STROKE} />
        </IconBtn>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="proto-a min-w-52 rounded-[12px] border-(--a-hairline) bg-(--a-surface) p-1"
      >
        {items.map((it) => (
          <DropdownMenuItem
            key={it.label}
            disabled={it.disabled}
            onSelect={it.onSelect}
            className={cn(
              'h-10 gap-2.5 rounded-[8px] px-2.5 text-[15px] [&_svg]:size-[18px]',
              it.danger
                ? 'text-(--a-danger) focus:text-(--a-danger)'
                : 'text-(--a-text)',
            )}
          >
            {it.icon}
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ---------------------------------------------------------------- hooks */

/** Short-lived "done" feedback for copy/remind buttons. */
export function useFlash(ms = 1800): [string | null, (key: string) => void] {
  const [key, setKey] = useState<string | null>(null)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  const flash = useCallback(
    (k: string) => {
      setKey(k)
      window.clearTimeout(t.current)
      t.current = window.setTimeout(() => setKey(null), ms)
    },
    [ms],
  )
  return [key, flash]
}

export function copyText(text: string) {
  try {
    void navigator.clipboard.writeText(text).catch(() => {})
  } catch {
    /* insecure context: ignore in the prototype */
  }
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function relTime(at: number): string {
  const min = Math.round((Date.now() - at) / 60_000)
  if (min < 1) return 'сега'
  if (min < 60) return `преди ${min} мин`
  const h = Math.round(min / 60)
  if (h < 24) return `преди ${h} ч`
  const d = Math.round(h / 24)
  return d === 1 ? 'вчера' : `преди ${d} дни`
}

export function shortDate(at: number): string {
  return new Intl.DateTimeFormat('bg-BG', {
    day: 'numeric',
    month: 'short',
  }).format(at)
}
