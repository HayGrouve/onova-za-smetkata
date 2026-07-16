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

import ConvexProvider from '../integrations/convex/provider'
import { AppShell } from '../components/layout/app-shell.tsx'
import { ConfirmActionProvider } from '../components/confirm-action-provider.tsx'
import { TooltipProvider } from '../components/ui/tooltip.tsx'
import { ThemeProvider } from '../components/theme-provider.tsx'
import { Toaster } from '../components/ui/sonner'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'

import { SentryInit } from '../components/sentry-init.tsx'
import { ServiceWorkerRegister } from '../components/service-worker-register.tsx'
import { SITE_NAME } from '#/lib/site-meta.ts'
import appCss from '../styles.css?url'

function RootError({ error }: ErrorComponentProps) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold">Нещо се обърка</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Опитайте да презаредите страницата.
        </p>
        {import.meta.env.DEV && error instanceof Error ? (
          <p className="mt-3 text-left text-xs text-destructive">
            {error.message}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        className="h-11"
        onClick={() => window.location.reload()}
      >
        <RefreshCwIcon className={ICON.button} aria-hidden />
        Опитай отново
      </Button>
    </div>
  )
}

export const Route = createRootRoute({
  head: () => ({
    title: SITE_NAME,
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        name: 'theme-color',
        content: '#faf9f7',
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: '#121214',
        media: '(prefers-color-scheme: dark)',
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
        rel: 'icon',
        href: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
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
          <ConfirmActionProvider>
            <TooltipProvider>
            <ConvexProvider>
              <SentryInit />
              <ServiceWorkerRegister />
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
