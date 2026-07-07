import { AppHeader } from '#/components/layout/app-header.tsx'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main>{children}</main>
    </div>
  )
}
