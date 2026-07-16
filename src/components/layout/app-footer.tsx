import { DownloadIcon } from 'lucide-react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { usePwaInstall } from '#/components/pwa-install-provider.tsx'

const VALUE_PROPS = [
  'Снимка на бележка → артикули автоматично',
  'QR линк за гостите на масата',
  'Revolut и IBAN за плащане',
] as const

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

export function AppFooter() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { canInstall, showIosSteps, install } = usePwaInstall()
  const [iosExpanded, setIosExpanded] = useState(false)

  if (isLoading || !isAuthenticated || pathname !== '/') {
    return null
  }

  return (
    <footer className="page-shell border-t border-border/60 py-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold">Предимства на приложението</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            {VALUE_PROPS.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-primary" aria-hidden>
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {canInstall ? (
          <div className="flex flex-col gap-2">
            {showIosSteps ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-fit"
                  onClick={() => setIosExpanded((open) => !open)}
                >
                  <DownloadIcon className={ICON.button} aria-hidden />
                  {iosExpanded
                    ? 'Скрий инструкциите'
                    : 'Добави на началния екран'}
                </Button>
                {iosExpanded ? (
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
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-fit"
                onClick={() => void install()}
              >
                <DownloadIcon className={ICON.button} aria-hidden />
                Инсталирай приложението
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </footer>
  )
}
