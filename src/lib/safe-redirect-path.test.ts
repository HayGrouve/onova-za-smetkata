import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from './safe-redirect-path.ts'

describe('safeRedirectPath', () => {
  it('keeps a same-origin path with its query and hash', () => {
    expect(safeRedirectPath('/bills/abc?x=1#h')).toBe('/bills/abc?x=1#h')
    expect(safeRedirectPath('/')).toBe('/')
  })

  it.each([
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    '/\\/evil.com',
    '/\t/evil.com',
    '/%2F%2Fevil.com',
    '/%5Cevil.com',
    '/%',
    'https://evil.com',
    'https://evil.com/bills',
    'javascript:alert(1)',
    'bills/abc',
    '',
  ])('refuses %j', (value) => {
    expect(safeRedirectPath(value)).toBeUndefined()
  })

  it('refuses anything that is not a string', () => {
    expect(safeRedirectPath(undefined)).toBeUndefined()
    expect(safeRedirectPath(['/bills'])).toBeUndefined()
  })
})
