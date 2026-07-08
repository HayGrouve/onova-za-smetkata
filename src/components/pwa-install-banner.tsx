import { DownloadIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { isIosInstallBrowser, isStandalonePwa } from '#/lib/pwa-install.ts'

const DISMISS_KEY = 'pwa-install-dismissed'
const VISIT_KEY = 'pwa-install-visits'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const IOS_INSTALL_STEPS = [
  'Плъзнете екрана надолу и изберете „Добавяне в началния екран“.',
  'Натиснете „Добави“ горе вдясно.',
] as const

function SafariShareIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [showIosSteps, setShowIosSteps] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    if (isStandalonePwa()) return

    const visits =
      Number.parseInt(localStorage.getItem(VISIT_KEY) ?? '0', 10) + 1
    localStorage.setItem(VISIT_KEY, String(visits))
    if (visits < 2) return

    if (isIosInstallBrowser()) {
      setShowIosSteps(true)
      setVisible(true)
      return
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
    }
  }, [])

  if (!visible) return null
  if (!showIosSteps && !deferredPrompt) return null

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
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
          {showIosSteps
            ? 'На iPhone добавете приложението ръчно към началния екран:'
            : 'Добавете „Онова за сметката“ на началния екран за по-бърз достъп.'}
        </p>
        {showIosSteps ? (
          <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
            <li>
              <span className="inline-flex flex-wrap items-center gap-1">
                Докоснете бутона Сподели
                <SafariShareIcon className="inline size-4 shrink-0 text-foreground" />
                в лентата на Safari долу.
              </span>
            </li>
            {IOS_INSTALL_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
        <div className="flex gap-2">
          {!showIosSteps ? (
            <Button
              type="button"
              size="sm"
              className="h-9"
              onClick={() => void handleInstall()}
            >
              Инсталирай
            </Button>
          ) : null}
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
