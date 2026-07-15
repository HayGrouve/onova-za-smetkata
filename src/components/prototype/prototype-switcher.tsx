import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { cn } from '#/lib/utils.ts'

export interface PrototypeVariantMeta {
  key: string
  label: string
}

interface PrototypeSwitcherProps {
  variants: PrototypeVariantMeta[]
  current: string
  className?: string
}

/** PROTOTYPE ONLY — floating variant bar. Hidden in production builds. */
export function PrototypeSwitcher({
  variants,
  current,
  className,
}: PrototypeSwitcherProps) {
  const navigate = useNavigate()

  if (import.meta.env.PROD) return null

  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  )
  const meta = variants[index] ?? variants[0]

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length]
    if (!next) return
    void navigate({
      to: '.',
      search: (prev) => ({ ...prev, variant: next.key }),
      replace: true,
    })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(-1)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // Prototype switcher: re-bind when current variant index changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional for throwaway prototype
  }, [index, variants])

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-foreground/20 bg-foreground px-2 py-1.5 text-background shadow-lg',
        className,
      )}
      role="navigation"
      aria-label="Prototype variant switcher"
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="text-background hover:bg-background/20 hover:text-background"
        aria-label="Previous variant"
        onClick={() => go(-1)}
      >
        <ChevronLeftIcon className="size-4" />
      </Button>
      <p className="min-w-40 text-center text-xs font-medium tabular-nums">
        {meta.key} — {meta.label}
      </p>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="text-background hover:bg-background/20 hover:text-background"
        aria-label="Next variant"
        onClick={() => go(1)}
      >
        <ChevronRightIcon className="size-4" />
      </Button>
    </div>
  )
}
