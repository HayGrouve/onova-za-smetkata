import { DownloadIcon } from 'lucide-react'
import { useHomeView } from '#/hooks/use-home-view.ts'
import { useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { usePwaInstall } from '#/components/pwa-install-provider.tsx'
import { LandingFooter } from '#/components/landing/landing-footer.tsx'

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
  const homeView = useHomeView()
  const { canInstall, showIosSteps, install } = usePwaInstall()
  const [iosExpanded, setIosExpanded] = useState(false)

  if (pathname !== '/') return null
  // Signed out, `/` is the landing page: its footer, outside <main>.
  if (homeView === 'landing') return <LandingFooter />
  if (homeView !== 'home' || !canInstall) return null

  return (
    <footer className="mx-auto w-full max-w-[1180px] px-4 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:px-6">
      <div className="flex flex-col gap-4 border-t-2 border-dashed border-table-3 pt-6">
        <div className="flex flex-col gap-2">
          {showIosSteps ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setIosExpanded((open) => !open)}
              >
                <DownloadIcon className={ICON.button} aria-hidden />
                {iosExpanded
                  ? 'Скрий инструкциите'
                  : 'Добави на началния екран'}
              </Button>
              {iosExpanded ? (
                <ol className="list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-on-table-muted">
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
              className="w-fit"
              onClick={() => void install()}
            >
              <DownloadIcon className={ICON.button} aria-hidden />
              Инсталирай приложението
            </Button>
          )}
        </div>
      </div>
    </footer>
  )
}
