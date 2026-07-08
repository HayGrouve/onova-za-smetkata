import { useEffect } from 'react'

export function SentryInit() {
  useEffect(() => {
    if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) return

    void import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
      })
    })
  }, [])

  return null
}
