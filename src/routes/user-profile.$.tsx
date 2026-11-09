import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * The old Clerk `UserProfile` page. The Акаунт now lives on the hub
 * (ADR 0005); what was Сметката's own here, Абонамент, is `/abonament`.
 * Stripe Checkout and the Customer Portal of old sessions may still return
 * to `/user-profile/subscription?checkout=success&session_id=…`, so the
 * query goes along.
 */
export const Route = createFileRoute('/user-profile/$')({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: `/abonament${location.searchStr}`,
      statusCode: 308,
    })
  },
})
