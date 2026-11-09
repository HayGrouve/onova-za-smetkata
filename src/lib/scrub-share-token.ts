/**
 * A share link carries `?t=<shareToken>`, which is guest-level access to a
 * bill. Analytics and Speed Insights record page URLs, so they must never see
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
