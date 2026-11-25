import { describe, expect, it } from 'vitest'
import { scrubEventUrl, scrubShareToken } from './scrub-share-token.ts'

describe('scrubShareToken', () => {
  it.each([
    ['/bills/abc/join?t=secret', '/bills/abc/join'],
    [
      'https://smetkata.onovaza.com/bills/abc/claim?t=secret&mode=x',
      'https://smetkata.onovaza.com/bills/abc/claim?mode=x',
    ],
    ['/bills/abc/pay?mode=x&t=secret', '/bills/abc/pay?mode=x'],
    ['/bills/abc/pay?a=1&t=secret&b=2#top', '/bills/abc/pay?a=1&b=2#top'],
    ['/bills/abc/join?t=secret#top', '/bills/abc/join#top'],
    ['GET /bills/abc/join?t=secret 200', 'GET /bills/abc/join 200'],
    ['/join?t=one&t=two', '/join'],
  ])('%s', (input, expected) => {
    expect(scrubShareToken(input)).toBe(expected)
  })

  it('leaves other params and plain paths alone', () => {
    for (const url of [
      '/bills/abc',
      '/bills/abc?at=1&format=2',
      '/login?redirect=%2Fbills%2Fabc',
      '/bills/t=1',
    ]) {
      expect(scrubShareToken(url)).toBe(url)
    }
  })
})

describe('scrubEventUrl', () => {
  it('scrubs the url and keeps the rest of the event', () => {
    expect(
      scrubEventUrl({ type: 'pageview', url: '/bills/a/join?t=x' }),
    ).toEqual({ type: 'pageview', url: '/bills/a/join' })
  })
})
