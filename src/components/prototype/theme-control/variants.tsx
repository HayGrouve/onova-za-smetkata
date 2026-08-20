/**
 * PROTOTYPE — throwaway. Three variants of a compact kebab theme control
 * via ?variant= on /prototype/theme-control.
 *
 * Question: sun | system | moon in one control — which structure fits
 * the kebab (w-52) with the locked host items under it?
 */
import {
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CogIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UsersIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'
import { HOST_ONBOARDING_HOME } from '../../../../shared/host-onboarding-messages.ts'

export type ThemeMode = 'light' | 'system' | 'dark'

export const THEME_MODES: ThemeMode[] = ['light', 'system', 'dark']

export const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  light: 'Светла',
  system: 'Системна',
  dark: 'Тъмна',
}

const MODE_ICON = {
  light: SunIcon,
  system: MonitorIcon,
  dark: MoonIcon,
} as const

export type ThemeControlProps = {
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
}

function FakeMenuRow({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm">
      {icon}
      {children}
    </div>
  )
}

function FakeKebabItems() {
  return (
    <>
      <p className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
        Сметка
      </p>
      <FakeMenuRow icon={<span className="size-4" />}>Сподели линк</FakeMenuRow>
      <FakeMenuRow icon={<span className="size-4" />}>
        Завърши сметка
      </FakeMenuRow>
      <div className="my-1 h-px bg-border" />
    </>
  )
}

function FakeHostItems() {
  return (
    <>
      <div className="my-1 h-px bg-border" />
      <FakeMenuRow icon={<CogIcon className={ICON.button} aria-hidden />}>
        Настройки за плащане
      </FakeMenuRow>
      <FakeMenuRow icon={<UsersIcon className={ICON.button} aria-hidden />}>
        Моите групи
      </FakeMenuRow>
      <FakeMenuRow icon={<BookOpenIcon className={ICON.button} aria-hidden />}>
        {HOST_ONBOARDING_HOME.helpAndGuidance}
      </FakeMenuRow>
    </>
  )
}

function KebabPanel({ children }: { children: ReactNode }) {
  return (
    <div className="w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
      {children}
    </div>
  )
}

function ThemeStateLine({ theme }: { theme: ThemeMode }) {
  return (
    <p className="font-mono text-xs text-muted-foreground">
      theme={theme} ({THEME_MODE_LABEL[theme]})
    </p>
  )
}

/** A — three equal icon cells, selected cell inverts. */
export function VariantA({ theme, onThemeChange }: ThemeControlProps) {
  return (
    <div className="flex flex-col gap-3">
      <KebabPanel>
        <FakeKebabItems />
        <div
          className="flex overflow-hidden rounded-md border"
          role="radiogroup"
          aria-label="Тема"
        >
          {THEME_MODES.map((mode) => {
            const Icon = MODE_ICON[mode]
            const selected = theme === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={THEME_MODE_LABEL[mode]}
                className={cn(
                  'tap-feedback flex h-11 flex-1 items-center justify-center',
                  selected
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground',
                )}
                onClick={() => onThemeChange(mode)}
              >
                <Icon className={ICON.button} />
              </button>
            )
          })}
        </div>
        <FakeHostItems />
      </KebabPanel>
      <ThemeStateLine theme={theme} />
    </div>
  )
}

/** B — three-stop rocker: thumb slides; sun and moon as endcaps, system is the middle stop. */
export function VariantB({ theme, onThemeChange }: ThemeControlProps) {
  const thumbIndex = THEME_MODES.indexOf(theme)

  return (
    <div className="flex flex-col gap-3">
      <KebabPanel>
        <FakeKebabItems />
        <div className="px-1 py-1">
          <div className="relative h-11 overflow-hidden rounded-full border bg-muted/60">
            <div className="pointer-events-none absolute inset-0.5 grid grid-cols-3">
              <div
                className="rounded-full bg-foreground shadow-sm transition-transform duration-200"
                style={{ transform: `translateX(${thumbIndex * 100}%)` }}
              />
            </div>
            <div className="relative z-10 grid h-full grid-cols-3">
              {THEME_MODES.map((mode) => {
                const Icon = MODE_ICON[mode]
                const selected = theme === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-label={THEME_MODE_LABEL[mode]}
                    aria-pressed={selected}
                    className={cn(
                      'tap-feedback flex items-center justify-center',
                      selected ? 'text-background' : 'text-muted-foreground',
                    )}
                    onClick={() => onThemeChange(mode)}
                  >
                    <Icon className={ICON.button} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <FakeHostItems />
      </KebabPanel>
      <ThemeStateLine theme={theme} />
    </div>
  )
}

function cycleTheme(current: ThemeMode, delta: number): ThemeMode {
  const i = THEME_MODES.indexOf(current)
  return THEME_MODES[(i + delta + THEME_MODES.length) % THEME_MODES.length]
}

/** C — one row stepper: arrows cycle, middle shows the current name. */
export function VariantC({ theme, onThemeChange }: ThemeControlProps) {
  const Icon = MODE_ICON[theme]

  return (
    <div className="flex flex-col gap-3">
      <KebabPanel>
        <FakeKebabItems />
        <div className="flex h-11 items-stretch overflow-hidden rounded-md border">
          <button
            type="button"
            className="tap-feedback flex w-10 items-center justify-center text-muted-foreground"
            aria-label="Предишна тема"
            onClick={() => onThemeChange(cycleTheme(theme, -1))}
          >
            <ChevronLeftIcon className={ICON.button} />
          </button>
          <p className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-sm">
            <Icon className={ICON.button} aria-hidden />
            <span className="truncate">{THEME_MODE_LABEL[theme]}</span>
          </p>
          <button
            type="button"
            className="tap-feedback flex w-10 items-center justify-center text-muted-foreground"
            aria-label="Следваща тема"
            onClick={() => onThemeChange(cycleTheme(theme, 1))}
          >
            <ChevronRightIcon className={ICON.button} />
          </button>
        </div>
        <FakeHostItems />
      </KebabPanel>
      <ThemeStateLine theme={theme} />
    </div>
  )
}

export const THEME_CONTROL_VARIANTS = [
  { key: 'A', label: 'Три клетки', Component: VariantA },
  { key: 'B', label: 'Плъзгач', Component: VariantB },
  { key: 'C', label: 'Стрелки', Component: VariantC },
] as const
