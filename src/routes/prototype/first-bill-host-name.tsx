import { createFileRoute } from '@tanstack/react-router'
import { NAME_VARIANTS } from '#/components/prototype/first-bill-host-name/prototype.tsx'
import type { NameVariantKey } from '#/components/prototype/first-bill-host-name/prototype.tsx'
import { PrototypeSwitcher } from '#/components/prototype/prototype-switcher.tsx'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

function isVariantKey(value: string): value is NameVariantKey {
  return NAME_VARIANTS.some(({ key }) => key === value)
}

export const Route = createFileRoute('/prototype/first-bill-host-name')({
  head: () => buildNoIndexHead('Prototype — first-bill Host name'),
  validateSearch: (search: Record<string, unknown>) => {
    const raw = typeof search.variant === 'string' ? search.variant : 'A'
    return { variant: isVariantKey(raw) ? raw : 'A' }
  },
  component: FirstBillHostNamePrototypePage,
})

function FirstBillHostNamePrototypePage() {
  const { variant } = Route.useSearch()
  const active =
    NAME_VARIANTS.find(({ key }) => key === variant) ?? NAME_VARIANTS[0]
  const Component = active.Component

  return (
    <div className="page-shell py-4">
      <Component key={variant} />
      <PrototypeSwitcher
        variants={NAME_VARIANTS.map(({ key, label }) => ({ key, label }))}
        current={active.key}
      />
    </div>
  )
}
