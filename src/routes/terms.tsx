import { createFileRoute, redirect } from '@tanstack/react-router'
import { HUB_TERMS_URL } from '#/lib/hub-links.ts'

/** The terms live on the hub, with Сметката's own section. */
export const Route = createFileRoute('/terms')({
  beforeLoad: () => {
    throw redirect({ href: HUB_TERMS_URL, statusCode: 308 })
  },
})
