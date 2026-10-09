import type { Breadcrumb, Event } from '@sentry/react'

/**
 * A share link carries `?t=<shareToken>`, which is guest-level access to a
 * bill. Error reports and analytics record page URLs, so they must never see
 * it. Everything here removes the `t` query param from text holding a URL.
 */
export function scrubShareToken(text: string): string {
  return (
    text
      // `?t=x&rest` keeps the `?`; any other `t` param goes with its `&` or `?`.
      .replace(/\?t=[^&#\s]*&/g, '?')
      .replace(/[?&]t=[^&#\s]*/g, '')
  )
}

/** Analytics and Speed Insights `beforeSend`: scrub the page URL of an event. */
export function scrubEventUrl<T extends { url: string }>(event: T): T {
  return { ...event, url: scrubShareToken(event.url) }
}

/** Sentry `beforeSend` / `beforeSendTransaction`: scrub where the page URL ends up. */
export function scrubSentryEvent<T extends Event>(event: T): T {
  if (event.transaction) event.transaction = scrubShareToken(event.transaction)

  const request = event.request
  if (request) {
    if (request.url) request.url = scrubShareToken(request.url)
    if (request.headers?.Referer) {
      request.headers.Referer = scrubShareToken(request.headers.Referer)
    }
    if (typeof request.query_string === 'string') {
      // No leading `?` in a bare query string; add one so `t=` is matched.
      request.query_string = scrubShareToken(`?${request.query_string}`).slice(
        1,
      )
    } else if (Array.isArray(request.query_string)) {
      request.query_string = request.query_string.filter(([key]) => key !== 't')
    } else if (request.query_string) {
      delete request.query_string.t
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb)
  }

  // Transactions: span names and URL attributes (`url`, `http.url`, `url.full`…).
  const trace = event.contexts?.trace
  if (trace?.data) scrubStringValues(trace.data)
  for (const span of event.spans ?? []) {
    if (span.description) span.description = scrubShareToken(span.description)
    scrubStringValues(span.data)
  }
  return event
}

/** Scrub every string (or list of strings) held directly in `record`. */
function scrubStringValues(record: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      record[key] = scrubShareToken(value)
    } else if (Array.isArray(value)) {
      record[key] = value.map((item: unknown) =>
        typeof item === 'string' ? scrubShareToken(item) : item,
      )
    }
  }
}

/** Sentry `beforeBreadcrumb`: navigation (`from`, `to`) and request (`url`) data. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.message) {
    breadcrumb.message = scrubShareToken(breadcrumb.message)
  }
  if (breadcrumb.data) scrubStringValues(breadcrumb.data)
  return breadcrumb
}
