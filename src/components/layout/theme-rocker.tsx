import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'
import {
  THEME_ROCKER_GROUP_LABEL,
  THEME_ROCKER_LABEL,
  THEME_ROCKER_MODES,
  resolveThemeRockerMode,
  themeRockerThumbIndex,
} from '../../../shared/theme-rocker.ts'
import type { ThemeRockerMode } from '../../../shared/theme-rocker.ts'

const MODE_ICON = {
  light: SunIcon,
  system: MonitorIcon,
  dark: MoonIcon,
} as const

/** Matches `--motion-slow`. Must finish before `setTheme` (see disableTransitionOnChange). */
const THUMB_MS = 250

function ThemeRockerIcons({ className }: { className?: string }) {
  return (
    <>
      {THEME_ROCKER_MODES.map((mode) => {
        const Icon = MODE_ICON[mode]
        return (
          <span
            key={mode}
            className={cn('flex items-center justify-center', className)}
            aria-hidden
          >
            <Icon className={ICON.button} />
          </span>
        )
      })}
    </>
  )
}

export function ThemeRocker({
  theme,
  onThemeChange,
}: {
  theme: string | undefined
  onThemeChange: (theme: ThemeRockerMode) => void
}) {
  const resolved = resolveThemeRockerMode(theme)
  const [visualMode, setVisualMode] = useState(resolved)
  const applyThemeTimeout = useRef<number | undefined>(undefined)

  useEffect(() => {
    setVisualMode(resolved)
  }, [resolved])

  useEffect(() => {
    return () => {
      if (applyThemeTimeout.current !== undefined) {
        window.clearTimeout(applyThemeTimeout.current)
      }
    }
  }, [])

  const thumbIndex = themeRockerThumbIndex(visualMode)

  function handleThemeChange(mode: ThemeRockerMode) {
    setVisualMode(mode)
    if (applyThemeTimeout.current !== undefined) {
      window.clearTimeout(applyThemeTimeout.current)
    }

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (reduceMotion) {
      onThemeChange(mode)
      return
    }

    applyThemeTimeout.current = window.setTimeout(() => {
      onThemeChange(mode)
      applyThemeTimeout.current = undefined
    }, THUMB_MS)
  }

  return (
    <div className="w-full px-1 py-1">
      <div
        role="radiogroup"
        aria-label={THEME_ROCKER_GROUP_LABEL}
        className="relative h-11 w-full overflow-hidden rounded-md bg-popover p-0.5"
        onPointerDown={(event) => event.preventDefault()}
      >
        <div className="relative grid h-full w-full grid-cols-3">
          {THEME_ROCKER_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={visualMode === mode}
              aria-label={THEME_ROCKER_LABEL[mode]}
              className="relative z-10 h-full w-full cursor-pointer"
              onPointerDown={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.stopPropagation()
                }
              }}
              onClick={() => handleThemeChange(mode)}
            />
          ))}
          <div
            className="pointer-events-none absolute inset-0 grid grid-cols-3 text-muted-foreground"
            aria-hidden
          >
            <ThemeRockerIcons />
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 overflow-hidden rounded-md bg-foreground shadow-sm motion-reduce:transition-none"
            style={{
              transform: `translateX(${thumbIndex * 100}%)`,
              transition: `transform ${THUMB_MS}ms var(--motion-ease)`,
            }}
            aria-hidden
          >
            <div
              className="grid h-full w-[300%] grid-cols-3 text-background motion-reduce:transition-none"
              style={{
                transform: `translateX(${(-thumbIndex * 100) / 3}%)`,
                transition: `transform ${THUMB_MS}ms var(--motion-ease)`,
              }}
            >
              <ThemeRockerIcons />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
