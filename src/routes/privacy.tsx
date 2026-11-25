import { createFileRoute, redirect } from '@tanstack/react-router'
import { HUB_PRIVACY_URL } from '#/lib/hub-links.ts'

/** The privacy policy lives on the hub, with Сметката's own section. */
export const Route = createFileRoute('/privacy')({
  beforeLoad: () => {
    throw redirect({ href: HUB_PRIVACY_URL, statusCode: 308 })
  },
})
