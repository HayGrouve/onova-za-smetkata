import { useEffect } from 'react'
import { ensurePwaInstallPromptCapture } from '#/lib/pwa-install-prompt.ts'

export function ServiceWorkerRegister() {
  useEffect(() => {
    ensurePwaInstallPromptCapture()

    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW is best-effort; offline banner still handles connectivity UX.
    })
  }, [])

  return null
}
