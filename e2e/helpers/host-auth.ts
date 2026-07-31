import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright'
import { expect, test as base } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'

export const E2E_HOST_AUTH_MESSAGE = [
  'E2E host auth is not available.',
  '',
  'Prerequisites:',
  '1. Terminal A: `npx convex dev`',
  '2. `.env.local`: `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`',
  '3. Optional: `E2E_CLERK_USER_EMAIL` for a Clerk dev test user',
  '4. Terminal B: `pnpm run test:e2e` (or reuse an existing `pnpm run dev`)',
].join('\n')

export async function openHostContext(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  await setupClerkTestingToken({ context })
  const page = await context.newPage()
  await page.goto('/')

  const email = process.env.E2E_CLERK_USER_EMAIL?.trim()
  if (email) {
    await clerk.signIn({ page, emailAddress: email })
    await page.goto('/')
  }

  try {
    await expect(page.getByRole('button', { name: 'Нова сметка' })).toBeVisible(
      {
        timeout: 45_000,
      },
    )
  } catch {
    await context.close()
    throw new Error(E2E_HOST_AUTH_MESSAGE)
  }

  return { context, page }
}

export const test = base
export { expect }
