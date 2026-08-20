import { createFileRoute } from '@tanstack/react-router'
import { MoreVerticalIcon } from 'lucide-react'
import { useState } from 'react'
import { PrototypeSwitcher } from '#/components/prototype/prototype-switcher.tsx'
import { THEME_CONTROL_VARIANTS } from '#/components/prototype/theme-control/variants.tsx'
import type { ThemeMode } from '#/components/prototype/theme-control/variants.tsx'
import { Button } from '#/components/ui/button.tsx'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

const VARIANT_KEYS = THEME_CONTROL_VARIANTS.map((v) => v.key)

export const Route = createFileRoute('/prototype/theme-control')({
  head: () => buildNoIndexHead('Prototype — theme control'),
  validateSearch: (search: Record<string, unknown>) => {
    const raw = typeof search.variant === 'string' ? search.variant : 'A'
    const variant = VARIANT_KEYS.includes(raw as 'A' | 'B' | 'C') ? raw : 'A'
    return { variant }
  },
  component: ThemeControlPrototypePage,
})

function ThemeControlPrototypePage() {
  const { variant } = Route.useSearch()
  const active =
    THEME_CONTROL_VARIANTS.find((v) => v.key === variant) ??
    THEME_CONTROL_VARIANTS[0]
  const Component = active.Component
  const [theme, setTheme] = useState<ThemeMode>('system')

  return (
    <div className="page-shell flex flex-col gap-4 py-4">
      <p className="text-sm text-muted-foreground">
        Прототип. Менюто е отворено нарочно — сравни контрола в реалната ширина
        на кебаба.
      </p>
      <header className="flex h-14 items-center gap-2 border-b">
        <p className="min-w-0 flex-1 truncate text-base font-semibold">
          Онова за сметката
        </p>
        <div className="size-7 shrink-0 rounded-full bg-muted" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Настройки"
        >
          <MoreVerticalIcon />
        </Button>
      </header>
      <div className="flex justify-end">
        <Component theme={theme} onThemeChange={setTheme} />
      </div>
      <PrototypeSwitcher
        variants={THEME_CONTROL_VARIANTS.map(({ key, label }) => ({
          key,
          label,
        }))}
        current={active.key}
      />
    </div>
  )
}
