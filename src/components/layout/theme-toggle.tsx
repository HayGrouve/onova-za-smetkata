import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="size-9 shrink-0" aria-hidden />
  }

  const TriggerIcon =
    theme === 'system'
      ? MonitorIcon
      : resolvedTheme === 'dark'
        ? MoonIcon
        : SunIcon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 tap-feedback"
          aria-label="Тема"
        >
          <TriggerIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={theme === 'light' ? 'bg-accent' : undefined}
        >
          <SunIcon className="size-4" />
          Светла тема
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={theme === 'dark' ? 'bg-accent' : undefined}
        >
          <MoonIcon className="size-4" />
          Тъмна тема
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={theme === 'system' ? 'bg-accent' : undefined}
        >
          <MonitorIcon className="size-4" />
          Системна тема
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
