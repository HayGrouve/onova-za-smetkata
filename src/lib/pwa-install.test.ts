import { describe, expect, it, vi } from 'vitest'
import { isIosInstallBrowser, isStandalonePwa } from './pwa-install'
import { isHostShellRoute } from './pwa-install-routes'

describe('isHostShellRoute', () => {
  it('allows home and bill host routes', () => {
    expect(isHostShellRoute('/')).toBe(true)
    expect(isHostShellRoute('/bills/abc123')).toBe(true)
    expect(isHostShellRoute('/bills/abc123/')).toBe(true)
    expect(isHostShellRoute('/bills/abc123/summary')).toBe(true)
  })

  it('blocks login and guest routes', () => {
    expect(isHostShellRoute('/login')).toBe(false)
    expect(isHostShellRoute('/bills/abc123/join')).toBe(false)
    expect(isHostShellRoute('/bills/abc123/claim')).toBe(false)
  })
})

describe('isStandalonePwa', () => {
  it('returns true when display-mode is standalone', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
      }),
      navigator: { standalone: false },
    })
    expect(isStandalonePwa()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('returns true when navigator.standalone is set (legacy iOS)', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false, media: '' }),
      navigator: { standalone: true },
    })
    expect(isStandalonePwa()).toBe(true)
    vi.unstubAllGlobals()
  })
})

describe('isIosInstallBrowser', () => {
  it('detects iPhone user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      maxTouchPoints: 5,
    })
    expect(isIosInstallBrowser()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('returns false on desktop Chrome', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      platform: 'Win32',
      maxTouchPoints: 0,
    })
    expect(isIosInstallBrowser()).toBe(false)
    vi.unstubAllGlobals()
  })
})
