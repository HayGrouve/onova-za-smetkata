import { describe, expect, it } from 'vitest'
import {
  THEME_ROCKER_GROUP_LABEL,
  THEME_ROCKER_LABEL,
  THEME_ROCKER_MODES,
  resolveThemeRockerMode,
  themeRockerThumbIndex,
} from './theme-rocker'

describe('theme rocker stops', () => {
  it('orders sun, system, moon with Bulgarian accessible names', () => {
    expect(THEME_ROCKER_MODES).toEqual(['light', 'system', 'dark'])
    expect(THEME_ROCKER_GROUP_LABEL).toBe('Тема')
    expect(THEME_ROCKER_LABEL).toEqual({
      light: 'Светла',
      system: 'Системна',
      dark: 'Тъмна',
    })
  })
})

describe('resolveThemeRockerMode', () => {
  it('keeps light, dark, and system', () => {
    expect(resolveThemeRockerMode('light')).toBe('light')
    expect(resolveThemeRockerMode('dark')).toBe('dark')
    expect(resolveThemeRockerMode('system')).toBe('system')
  })

  it('defaults unknown or unset theme to system', () => {
    expect(resolveThemeRockerMode(undefined)).toBe('system')
    expect(resolveThemeRockerMode('auto')).toBe('system')
  })
})

describe('themeRockerThumbIndex', () => {
  it('maps light to the first stop and dark to the last', () => {
    expect(themeRockerThumbIndex('light')).toBe(0)
    expect(themeRockerThumbIndex('system')).toBe(1)
    expect(themeRockerThumbIndex('dark')).toBe(2)
    expect(themeRockerThumbIndex(undefined)).toBe(1)
  })
})
