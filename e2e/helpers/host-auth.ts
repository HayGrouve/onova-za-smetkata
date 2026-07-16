import { expect, test as base } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'

export const E2E_HOST_AUTH_MESSAGE = [
  'E2E host auth is not available.',
  '',
  'Prerequisites:',
  '1. Terminal A: `npx convex dev`',
  '2. Convex Dashboard on that deployment: `DEV_MODE=true` (`npx convex env set DEV_MODE true`)',
  '3. `.env.local`: `VITE_CONVEX_URL` points to the same dev deployment',
  '4. Terminal B: `pnpm run test:e2e` (or reuse an existing `pnpm run dev`)',
].join('\n')

export async function openHostContext(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/')

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
