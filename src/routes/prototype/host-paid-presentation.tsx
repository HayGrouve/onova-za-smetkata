import { createFileRoute } from '@tanstack/react-router'
import { PrototypeSwitcher } from '#/components/prototype/prototype-switcher.tsx'
import { HOST_PAID_VARIANTS } from '#/components/prototype/host-paid-presentation/variants.tsx'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

const VARIANT_KEYS = HOST_PAID_VARIANTS.map((v) => v.key)

export const Route = createFileRoute('/prototype/host-paid-presentation')({
  head: () => buildNoIndexHead('Prototype — host paid'),
  validateSearch: (search: Record<string, unknown>) => {
    const raw = typeof search.variant === 'string' ? search.variant : 'A'
    const variant = VARIANT_KEYS.includes(raw as 'A' | 'B' | 'C') ? raw : 'A'
    return { variant }
  },
  component: HostPaidPresentationPrototypePage,
})

function HostPaidPresentationPrototypePage() {
  const { variant } = Route.useSearch()
  const active =
    HOST_PAID_VARIANTS.find((v) => v.key === variant) ?? HOST_PAID_VARIANTS[0]!
  const Component = active.Component

  return (
    <div className="page-shell py-4">
      <Component />
      <PrototypeSwitcher
        variants={HOST_PAID_VARIANTS.map(({ key, label }) => ({ key, label }))}
        current={active.key}
      />
    </div>
  )
}
