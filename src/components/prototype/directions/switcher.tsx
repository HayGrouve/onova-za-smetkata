/**
 * PROTOTYPE ONLY — floating control to flip between design directions and
 * between the host and guest phone. ←/→ switch direction. Hidden in prod.
 */
import { useEffect, useState } from 'react'
import { RotateCcwIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import type { ProtoView } from './types.ts'

export interface SwitcherVariant {
  key: string
  label: string
}

export function DirectionSwitcher({
  variants,
  current,
  view,
  onVariant,
  onView,
  onReset,
}: {
  variants: SwitcherVariant[]
  current: string
  view: ProtoView
  onVariant: (key: string) => void
  onView: (view: ProtoView) => void
  onReset: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const i = variants.findIndex((v) => v.key === current)
      if (e.key === 'ArrowRight') onVariant(variants[(i + 1) % variants.length].key)
      if (e.key === 'ArrowLeft') onVariant(variants[(i - 1 + variants.length) % variants.length].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [variants, current, onVariant])

  if (import.meta.env.PROD) return null

  const seg = 'h-7 rounded-full px-2.5 text-[11px] font-semibold transition-colors'
  return (
    <div
      data-proto-switcher
      className="fixed bottom-24 right-2 z-[100] flex items-center gap-1 rounded-full bg-zinc-900/90 p-1 text-zinc-100 shadow-lg ring-1 ring-white/10 backdrop-blur"
      style={{ fontFamily: 'ui-sans-serif, system-ui' }}
    >
      <button type="button" className={cn(seg, 'px-2 text-zinc-400')} onClick={() => setCollapsed((c) => !c)} aria-label="Сгъни">
        {collapsed ? current : '×'}
      </button>
      {!collapsed && (
        <>
          {variants.map((v) => (
            <button
              key={v.key}
              type="button"
              title={v.label}
              onClick={() => onVariant(v.key)}
              className={cn(seg, v.key === current ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-300 hover:bg-white/10')}
            >
              {v.key}
            </button>
          ))}
          <span className="mx-0.5 h-4 w-px bg-white/15" />
          {(['host', 'guest'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={cn(seg, v === view ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-300 hover:bg-white/10')}
            >
              {v === 'host' ? 'Домакин' : 'Гост'}
            </button>
          ))}
          <button type="button" onClick={onReset} className={cn(seg, 'text-zinc-400 hover:bg-white/10')} aria-label="Нулирай данните">
            <RotateCcwIcon className="size-3.5" />
          </button>
        </>
      )}
    </div>
  )
}
