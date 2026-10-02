import { describe, expect, it } from 'vitest'
import { resolveThemeRockerMode, themeRockerThumbIndex } from './theme-rocker'

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
