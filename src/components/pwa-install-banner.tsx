import { DownloadIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'

const DISMISS_KEY = 'pwa-install-dismissed'
const VISIT_KEY = 'pwa-install-visits'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    const visits =
      Number.parseInt(localStorage.getItem(VISIT_KEY) ?? '0', 10) + 1
    localStorage.setItem(VISIT_KEY, String(visits))

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      if (visits >= 2) setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
    }
  }, [])

  if (!visible || !deferredPrompt) return null

  async function handleInstall() {
    await deferredPrompt!.prompt()
    const { outcome } = await deferredPrompt!.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
      setDeferredPrompt(null)
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
    setDeferredPrompt(null)
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <DownloadIcon
        className={`${ICON.section} mt-0.5 shrink-0 text-primary`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-medium">Инсталирай приложението</p>
        <p className="text-xs text-muted-foreground">
          Добавете „Онова за сметката“ на началния екран за по-бърз достъп.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="h-9"
            onClick={() => void handleInstall()}
          >
            Инсталирай
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9"
            onClick={handleDismiss}
          >
            <XIcon className={ICON.button} aria-hidden />
            Не сега
          </Button>
        </div>
      </div>
    </div>
  )
}
