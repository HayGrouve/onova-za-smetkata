import { useEffect } from 'react'
import { scrubBreadcrumb, scrubSentryEvent } from '#/lib/scrub-share-token.ts'

export function SentryInit() {
  useEffect(() => {
    if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) return

    void import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
        // Page URLs carry the share token (?t=); keep it out of reports.
        beforeSend: scrubSentryEvent,
        beforeSendTransaction: scrubSentryEvent,
        beforeBreadcrumb: scrubBreadcrumb,
      })
    })
  }, [])

  return null
}
