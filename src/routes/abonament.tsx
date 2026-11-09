import { createFileRoute } from '@tanstack/react-router'
import { SubscriptionPage } from '#/components/subscription/subscription-page.tsx'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

export const Route = createFileRoute('/abonament')({
  head: () => buildNoIndexHead('Абонамент'),
  component: SubscriptionPage,
})
