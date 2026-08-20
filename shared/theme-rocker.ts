export type ThemeRockerMode = 'light' | 'system' | 'dark'

export const THEME_ROCKER_MODES: readonly ThemeRockerMode[] = [
  'light',
  'system',
  'dark',
]

export const THEME_ROCKER_GROUP_LABEL = 'Тема'

export const THEME_ROCKER_LABEL: Record<ThemeRockerMode, string> = {
  light: 'Светла',
  system: 'Системна',
  dark: 'Тъмна',
}

export function resolveThemeRockerMode(
  theme: string | undefined,
): ThemeRockerMode {
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    return theme
  }
  return 'system'
}

export function themeRockerThumbIndex(theme: string | undefined): number {
  return THEME_ROCKER_MODES.indexOf(resolveThemeRockerMode(theme))
}
