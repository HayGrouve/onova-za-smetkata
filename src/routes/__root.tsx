import { RefreshCwIcon } from 'lucide-react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

import ConvexProvider from '../integrations/convex/provider'
import { AppShell } from '../components/layout/app-shell.tsx'
import { ConfirmActionProvider } from '../components/confirm-action-provider.tsx'
import { TooltipProvider } from '../components/ui/tooltip.tsx'
import { ThemeProvider } from '../components/theme-provider.tsx'
import { ThemeColorMeta } from '../components/theme-color-meta.tsx'
import { Toaster } from '../components/ui/sonner'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { isDefiniteErrorReason } from '#/lib/definite-error-reason.ts'
import { getConvexErrorData } from '#/lib/convex-error.ts'

import { SentryInit } from '../components/sentry-init.tsx'
import { ServiceWorkerRegister } from '../components/service-worker-register.tsx'
import { SITE_NAME, titleMeta } from '#/lib/site-meta.ts'
import appCss from '../styles.css?url'

function RootError({ error }: ErrorComponentProps) {
  // A reason the server gave on purpose („Сметката не е намерена“) beats a
  // generic one; a reload cannot fix it, so offer the way home as well.
  const reason = getConvexErrorData(error)
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold">Нещо се обърка</h1>
        <p className="mt-2 text-sm text-muted-foreground" role="alert">
          {reason ?? 'Опитайте да презаредите страницата.'}
        </p>
        {import.meta.env.DEV && error instanceof Error ? (
          <p className="mt-3 text-left text-xs text-destructive">
            {error.message}
          </p>
        ) : null}
      </div>
      {isDefiniteErrorReason(reason) ? null : (
        <Button
          type="button"
          className="h-11"
          onClick={() => window.location.reload()}
        >
          <RefreshCwIcon className={ICON.button} aria-hidden />
          Опитай отново
        </Button>
      )}
      <Button asChild variant="outline" className="h-11">
        <a href="/">Към началото</a>
      </Button>
    </div>
  )
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      titleMeta(SITE_NAME),
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: 'any',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
    ],
  }),
  component: RootLayout,
  shellComponent: RootDocument,
  errorComponent: RootError,
})

function RootLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          storageKey="onova-theme"
          disableTransitionOnChange
        >
          <ThemeColorMeta />
          <ConfirmActionProvider>
            <TooltipProvider>
              <ConvexProvider>
                <SentryInit />
                <ServiceWorkerRegister />
                <Analytics />
                <SpeedInsights />
                {children}
                <Toaster />
                {import.meta.env.DEV && (
                  <TanStackDevtools
                    config={{
                      position: 'bottom-right',
                    }}
                    plugins={[
                      {
                        name: 'Tanstack Router',
                        render: <TanStackRouterDevtoolsPanel />,
                      },
                    ]}
                  />
                )}
              </ConvexProvider>
            </TooltipProvider>
          </ConfirmActionProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
