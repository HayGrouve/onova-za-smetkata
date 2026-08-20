import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
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

export function ThemeRocker({
  theme,
  onThemeChange,
}: {
  theme: string | undefined
  onThemeChange: (theme: ThemeRockerMode) => void
}) {
  const selected = resolveThemeRockerMode(theme)
  const thumbIndex = themeRockerThumbIndex(theme)

  return (
    <div className="px-1 py-1">
      <div
        role="radiogroup"
        aria-label={THEME_ROCKER_GROUP_LABEL}
        className="relative h-11 overflow-hidden rounded-full border bg-muted/60"
        onPointerDown={(event) => event.preventDefault()}
      >
        <div className="pointer-events-none absolute inset-0.5 grid grid-cols-3">
          <div
            className="rounded-full bg-foreground shadow-sm transition-transform duration-200"
            style={{ transform: `translateX(${thumbIndex * 100}%)` }}
          />
        </div>
        <div className="relative z-10 grid h-full grid-cols-3">
          {THEME_ROCKER_MODES.map((mode) => {
            const Icon = MODE_ICON[mode]
            const isSelected = selected === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={THEME_ROCKER_LABEL[mode]}
                className={cn(
                  'tap-feedback flex items-center justify-center',
                  isSelected ? 'text-background' : 'text-muted-foreground',
                )}
                onPointerDown={(event) => event.preventDefault()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.stopPropagation()
                  }
                }}
                onClick={() => onThemeChange(mode)}
              >
                <Icon className={ICON.button} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
