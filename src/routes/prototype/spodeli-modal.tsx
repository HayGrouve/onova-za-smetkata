import { createFileRoute } from '@tanstack/react-router'
import { PrototypeSwitcher } from '#/components/prototype/prototype-switcher.tsx'
import { SPODELI_MODAL_VARIANTS } from '#/components/prototype/spodeli-modal/variants.tsx'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

const VARIANT_KEYS = SPODELI_MODAL_VARIANTS.map((v) => v.key)

export const Route = createFileRoute('/prototype/spodeli-modal')({
  head: () => buildNoIndexHead('Prototype — Сподели modal'),
  validateSearch: (search: Record<string, unknown>) => {
    const raw = typeof search.variant === 'string' ? search.variant : 'A'
    const variant = VARIANT_KEYS.includes(raw as 'A' | 'B' | 'C') ? raw : 'A'
    return { variant }
  },
  component: SpodeliModalPrototypePage,
})

function SpodeliModalPrototypePage() {
  const { variant } = Route.useSearch()
  const active =
    SPODELI_MODAL_VARIANTS.find((v) => v.key === variant) ??
    SPODELI_MODAL_VARIANTS[0]!
  const Component = active.Component

  return (
    <div className="page-shell py-4">
      <Component />
      <PrototypeSwitcher
        variants={SPODELI_MODAL_VARIANTS.map(({ key, label }) => ({
          key,
          label,
        }))}
        current={active.key}
      />
    </div>
  )
}
