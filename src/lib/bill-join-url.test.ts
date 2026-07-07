import { describe, expect, it } from 'vitest'
import { buildBillJoinPath, buildBillJoinUrl } from './bill-join-url.ts'

describe('buildBillJoinPath', () => {
  it('returns join path for bill id', () => {
    expect(buildBillJoinPath('j57abc123')).toBe('/bills/j57abc123/join')
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
})
