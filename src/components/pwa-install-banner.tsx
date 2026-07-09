import { DownloadIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { usePwaInstall } from '#/components/pwa-install-provider.tsx'

const BANNER_DISMISS_KEY = 'pwa-banner-dismissed'
const LEGACY_DISMISS_KEY = 'pwa-install-dismissed'

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

function isBannerDismissed(): boolean {
  if (localStorage.getItem(BANNER_DISMISS_KEY) === '1') return true
  if (localStorage.getItem(LEGACY_DISMISS_KEY) === '1') {
    localStorage.setItem(BANNER_DISMISS_KEY, '1')
    return true
  }
  return false
}

export function PwaInstallBanner() {
  const { canInstall, showIosSteps, deferredPrompt, install } = usePwaInstall()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isBannerDismissed() || !canInstall) return
    setVisible(true)
  }, [canInstall])

  if (!visible) return null
  if (!showIosSteps && !deferredPrompt) return null

  async function handleInstall() {
    const result = await install()
    if (result.outcome === 'accepted') {
      setVisible(false)
    }
  }

  function handleDismiss() {
    localStorage.setItem(BANNER_DISMISS_KEY, '1')
    setVisible(false)
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
