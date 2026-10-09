import { describe, expect, it } from 'vitest'
import {
  scrubBreadcrumb,
  scrubEventUrl,
  scrubSentryEvent,
  scrubShareToken,
} from './scrub-share-token.ts'

describe('scrubShareToken', () => {
  it.each([
    ['/bills/abc/join?t=secret', '/bills/abc/join'],
    [
      'https://onova-za-smetkata.com/bills/abc/claim?t=secret&mode=x',
      'https://onova-za-smetkata.com/bills/abc/claim?mode=x',
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

describe('scrubSentryEvent', () => {
  it('scrubs the request, transaction and breadcrumbs', () => {
    const event = scrubSentryEvent({
      transaction: '/bills/a/join?t=x',
      request: {
        url: 'https://onova-za-smetkata.com/bills/a/join?t=x&m=1',
        headers: { Referer: 'https://onova-za-smetkata.com/bills/a?t=x' },
        query_string: 't=x&m=1',
      },
      breadcrumbs: [
        {
          category: 'navigation',
          data: { from: '/bills/a?t=x', to: '/bills/a/claim?t=x' },
        },
        { category: 'fetch', data: { url: '/api?t=x', status_code: 200 } },
      ],
    })
    expect(event).toEqual({
      transaction: '/bills/a/join',
      request: {
        url: 'https://onova-za-smetkata.com/bills/a/join?m=1',
        headers: { Referer: 'https://onova-za-smetkata.com/bills/a' },
        query_string: 'm=1',
      },
      breadcrumbs: [
        {
          category: 'navigation',
          data: { from: '/bills/a', to: '/bills/a/claim' },
        },
        { category: 'fetch', data: { url: '/api', status_code: 200 } },
      ],
    })
  })

  it('drops t from an object or list query string', () => {
    expect(
      scrubSentryEvent({ request: { query_string: { t: 'x', m: '1' } } }),
    ).toEqual({ request: { query_string: { m: '1' } } })
    expect(
      scrubSentryEvent({
        request: {
          query_string: [
            ['t', 'x'],
            ['m', '1'],
          ],
        },
      }),
    ).toEqual({ request: { query_string: [['m', '1']] } })
  })

  it('scrubs span names and URL attributes of a transaction', () => {
    const span = {
      span_id: '1',
      trace_id: '2',
      start_timestamp: 0,
      description: 'GET /bills/a/join?t=x',
      data: {
        url: '/bills/a/join?t=x',
        'http.url': 'https://onova-za-smetkata.com/bills/a/join?t=x',
        'url.full': 'https://onova-za-smetkata.com/bills/a/claim?m=1&t=x',
        'http.query': '?t=x',
        'http.response.status_code': 200,
        tags: ['/bills/a?t=x'],
      },
    }
    const event = scrubSentryEvent({
      type: 'transaction',
      contexts: {
        trace: {
          trace_id: '2',
          span_id: '3',
          data: { 'url.full': '/bills/a/pay?t=x' },
        },
      },
      spans: [span],
    })
    expect(event.contexts.trace.data).toEqual({ 'url.full': '/bills/a/pay' })
    expect(event.spans[0]).toMatchObject({
      description: 'GET /bills/a/join',
      data: {
        url: '/bills/a/join',
        'http.url': 'https://onova-za-smetkata.com/bills/a/join',
        'url.full': 'https://onova-za-smetkata.com/bills/a/claim?m=1',
        'http.query': '',
        'http.response.status_code': 200,
        tags: ['/bills/a'],
      },
    })
  })

  it('passes an event without a URL through', () => {
    expect(scrubSentryEvent({ message: 'boom' })).toEqual({ message: 'boom' })
  })
})

describe('scrubBreadcrumb', () => {
  it('scrubs a breadcrumb without data', () => {
    expect(scrubBreadcrumb({ message: 'opened /join?t=x' })).toEqual({
      message: 'opened /join',
    })
  })
})
