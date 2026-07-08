import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW is best-effort; offline banner still handles connectivity UX.
    })
  }, [])

  return null
}
