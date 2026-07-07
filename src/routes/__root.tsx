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
import { Toaster } from '../components/ui/sonner'
import { Button } from '#/components/ui/button.tsx'

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
          <p className="mt-3 text-left text-xs text-destructive">{error.message}</p>
        ) : null}
      </div>
      <Button type="button" className="h-11" onClick={() => window.location.reload()}>
        Опитай отново
      </Button>
    </div>
  )
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Онова за сметката',
      },
      {
        name: 'theme-color',
        content: '#0f172a',
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
    <html lang="bg">
      <head>
        <HeadContent />
      </head>
      <body>
        <ConvexProvider>
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
        <Scripts />
      </body>
    </html>
  )
}
