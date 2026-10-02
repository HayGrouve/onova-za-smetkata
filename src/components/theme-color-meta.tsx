import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

/** The table colour (`--table`) in each theme, for the browser's toolbar. */
const THEME_COLOR = { light: '#dadee3', dark: '#10171f' } as const

/**
 * The browser bar follows the app's theme, not the OS: the theme menu can
 * differ from the system. Two media-scoped metas won't do either, because
 * TanStack keeps only one meta per name. React hoists this into <head>.
 */
export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme()
  // The server can't know the stored theme; match it (dark) until hydrated.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const theme = mounted && resolvedTheme === 'light' ? 'light' : 'dark'
  return <meta name="theme-color" content={THEME_COLOR[theme]} />
}
