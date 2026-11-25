import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * `/login` hands signed-out visitors to Clerk's sign-in URL. Locally and on
 * previews the sign-in URL env is unset, so that is the dev instance's
 * Account Portal (`*.accounts.dev/sign-in`); production uses onovaza.com/vhod.
 * Waits until Clerk's sign-in page carries `redirect_url` = `returnUrl`, the
 * page the Host comes back to.
 */
export async function expectSignInBounce(page: Page, returnUrl: string) {
  await expect
    .poll(
      () => {
        const url = new URL(page.url())
        if (!/\.accounts\.dev$/.test(url.hostname)) return `on ${url.href}`
        if (!url.pathname.startsWith('/sign-in')) return `on ${url.href}`
        return url.searchParams.get('redirect_url')
      },
      { timeout: 30_000 },
    )
    .toBe(returnUrl)
}
