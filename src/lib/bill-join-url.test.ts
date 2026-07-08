import { describe, expect, it } from 'vitest'
import { buildBillJoinPath, buildBillJoinUrl } from './bill-join-url.ts'

describe('buildBillJoinPath', () => {
  it('returns join path for bill id', () => {
    expect(buildBillJoinPath('j57abc123')).toBe('/bills/j57abc123/join')
  })

  it('includes share token query param when provided', () => {
    expect(buildBillJoinPath('j57abc123', 'secret-token')).toBe(
      '/bills/j57abc123/join?t=secret-token',
    )
  })
})

describe('buildBillJoinUrl', () => {
  it('combines origin and join path', () => {
    expect(buildBillJoinUrl('j57abc123', 'https://onova.example.com')).toBe(
      'https://onova.example.com/bills/j57abc123/join',
    )
  })

  it('strips trailing slash from origin', () => {
    expect(buildBillJoinUrl('j57abc123', 'https://onova.example.com/')).toBe(
      'https://onova.example.com/bills/j57abc123/join',
    )
  })

  it('includes share token in full url', () => {
    expect(
      buildBillJoinUrl('j57abc123', 'https://onova.example.com', 'tok'),
    ).toBe('https://onova.example.com/bills/j57abc123/join?t=tok')
  })
})
