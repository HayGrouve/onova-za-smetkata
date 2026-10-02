/** PROTOTYPE — three design directions for host and guest flows. No Convex. */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { DirectionA } from '#/components/prototype/directions/a/index.tsx'
import { DirectionB } from '#/components/prototype/directions/b/index.tsx'
import { DirectionC } from '#/components/prototype/directions/c/index.tsx'
import { MockBillProvider } from '#/components/prototype/directions/mock/store.tsx'
import { DirectionSwitcher } from '#/components/prototype/directions/switcher.tsx'
import type { ProtoView } from '#/components/prototype/directions/types.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

const VARIANTS = [
  { key: 'A', label: 'A · Познато и бързо', Component: DirectionA },
  { key: 'B', label: 'B · Фокус', Component: DirectionB },
  { key: 'C', label: 'C · Живата сметка', Component: DirectionC },
] as const

type VariantKey = (typeof VARIANTS)[number]['key']

function isVariant(v: unknown): v is VariantKey {
  return VARIANTS.some(({ key }) => key === v)
}

export const Route = createFileRoute('/prototype/directions')({
  head: () => buildNoIndexHead('Прототип: три посоки'),
  validateSearch: (
    s: Record<string, unknown>,
  ): { variant: VariantKey; view: ProtoView } => ({
    variant: isVariant(s.variant) ? s.variant : 'A',
    view: s.view === 'guest' ? 'guest' : 'host',
  }),
  component: DirectionsPrototypePage,
})

function DirectionsPrototypePage() {
  const { variant, view } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [resetKey, setResetKey] = useState(0)
  const active = VARIANTS.find(({ key }) => key === variant) ?? VARIANTS[0]
  const Component = active.Component

  const setView = useCallback(
    (next: ProtoView) =>
      void navigate({ search: (p) => ({ ...p, view: next }), replace: true }),
    [navigate],
  )
  const setVariant = useCallback(
    (next: string) =>
      isVariant(next) &&
      void navigate({
        search: (p) => ({ ...p, variant: next }),
        replace: true,
      }),
    [navigate],
  )

  return (
    <MockBillProvider key={`${variant}-${resetKey}`}>
      <Component view={view} setView={setView} />
      <DirectionSwitcher
        variants={VARIANTS.map(({ key, label }) => ({ key, label }))}
        current={variant}
        view={view}
        onVariant={setVariant}
        onView={setView}
        onReset={() => setResetKey((k) => k + 1)}
      />
    </MockBillProvider>
  )
}
