import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { isIosInstallBrowser, isStandalonePwa } from '#/lib/pwa-install.ts'
import type { BeforeInstallPromptEvent } from '#/lib/pwa-install-prompt.ts'
import {
  ensurePwaInstallPromptCapture,
  getDeferredPrompt,
  promptPwaInstall,
  subscribeToDeferredPrompt,
} from '#/lib/pwa-install-prompt.ts'

interface PwaInstallContextValue {
  canInstall: boolean
  showIosSteps: boolean
  deferredPrompt: BeforeInstallPromptEvent | null
  install: () => Promise<{ outcome: 'accepted' | 'dismissed' | 'unavailable' }>
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null)

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    ensurePwaInstallPromptCapture()
    setStandalone(isStandalonePwa())
    setDeferredPrompt(getDeferredPrompt())

    return subscribeToDeferredPrompt(() => {
      setDeferredPrompt(getDeferredPrompt())
      setStandalone(isStandalonePwa())
    })
  }, [])

  const showIosSteps = isIosInstallBrowser()
  const canInstall = !standalone && (showIosSteps || deferredPrompt !== null)

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      canInstall,
      showIosSteps,
      deferredPrompt,
      install: promptPwaInstall,
    }),
    [canInstall, showIosSteps, deferredPrompt],
  )

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  )
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext)
  if (!context) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider')
  }
  return context
}
