/** PROTOTYPE Direction C: small shared pieces (seat avatars, stamps, copy helpers). */
import { motion } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '#/lib/utils.ts'
import type { SeatSummary } from '../mock/store.tsx'

/** Five muted seat hues at equal lightness/chroma. Always shown with the initial. */
const SEAT_HUES = [255, 160, 85, 320, 200]

export function seatColor(index: number): string {
  return `oklch(0.74 0.09 ${SEAT_HUES[((index % 5) + 5) % 5]})`
}

export function seatIndex(seats: SeatSummary[], id: string): number {
  return Math.max(
    0,
    seats.findIndex((s) => s.participantId === id),
  )
}

const SIZES = {
  xs: 'size-[22px] text-[10px]',
  sm: 'size-8 text-[12px]',
  md: 'size-11 text-[15px]',
  lg: 'size-14 text-[19px]',
} as const

/**
 * Initials per seat name. When two names share a first letter (Даниел, Деси)
 * both get two letters (Да, Де), so identity never rests on color alone.
 */
export function buildInitials(names: string[]): Map<string, string> {
  const clean = names.map((n) => n.trim())
  const map = new Map<string, string>()
  for (const n of clean) {
    const one = n.charAt(0).toUpperCase()
    const clash = clean.some(
      (o) => o !== n && o.charAt(0).toUpperCase() === one,
    )
    if (!clash) {
      map.set(n, one)
      continue
    }
    const two = one + n.charAt(1).toLowerCase()
    const clash2 = clean.some(
      (o) =>
        o !== n &&
        o.charAt(0).toUpperCase() + o.charAt(1).toLowerCase() === two,
    )
    map.set(n, clash2 ? one + n.charAt(n.length - 1).toLowerCase() : two)
  }
  return map
}

export const InitialsContext = createContext<Map<string, string>>(new Map())

export function SeatAvatar({
  seat,
  index,
  size = 'sm',
  ring = 'none',
  className,
  style,
}: {
  seat: Pick<SeatSummary, 'initial' | 'name'>
  index: number
  size?: keyof typeof SIZES
  /** joined = solid ring, away = dashed (has not opened the link), brush = vermilion. */
  ring?: 'none' | 'joined' | 'away' | 'brush'
  className?: string
  style?: CSSProperties
}) {
  const label =
    useContext(InitialsContext).get(seat.name.trim()) ?? seat.initial
  return (
    <span
      aria-hidden
      className={cn(
        'c-display relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-[var(--c-ink)]',
        SIZES[size],
        ring === 'joined' &&
          'ring-2 ring-[var(--c-on-table)] ring-offset-2 ring-offset-[var(--ring-offset,var(--c-table))]',
        ring === 'away' &&
          'outline-dashed outline-2 outline-offset-2 outline-[var(--c-on-table-muted)]',
        ring === 'brush' &&
          'ring-[3px] ring-[var(--c-accent)] ring-offset-2 ring-offset-[var(--ring-offset,var(--c-table))]',
        className,
      )}
      style={{
        background: seatColor(index),
        letterSpacing: label.length > 1 ? '-0.04em' : 0,
        ...style,
      }}
    >
      {label}
    </span>
  )
}

export function Stamp({
  kind,
  children,
  className,
}: {
  kind: 'paid' | 'wait'
  children: ReactNode
  className?: string
}) {
  return (
    <motion.span
      initial={{ scale: 1.5, rotate: -16, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 0.92 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 520, damping: 22, mass: 0.8 }}
      className={cn(
        'c-stamp inline-block',
        kind === 'wait' && 'c-stamp-wait',
        className,
      )}
    >
      {children}
    </motion.span>
  )
}

const eur = new Intl.NumberFormat('bg-BG', {
  style: 'currency',
  currency: 'EUR',
})
export function formatMoney(cents: number): string {
  return eur.format(cents / 100)
}

export function clock(at: number): string {
  return new Date(at).toLocaleTimeString('bg-BG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Copy to clipboard with a short-lived "copied" flag. */
export function useCopy(): [
  string | null,
  (key: string, text: string) => void,
] {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = useCallback((key: string, text: string) => {
    void navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(null), 1800)
  }, [])
  return [copied, copy]
}

/** Native share sheet where available, clipboard otherwise. Returns true when copied. */
export async function shareOrCopy(data: {
  title: string
  text: string
  url?: string
}): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share(data)
      return false
    } catch {
      // cancelled or blocked; fall through to clipboard
    }
  }
  await navigator.clipboard
    .writeText([data.text, data.url].filter(Boolean).join(' '))
    .catch(() => {})
  return true
}

export const BILL_URL = 'onova.bg/s/chuchura-4k7'

const noop = () => () => {}
/** False during SSR and hydration, true after. Mock times differ between server and client. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
}
