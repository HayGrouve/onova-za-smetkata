import type { Page } from '@playwright/test'
import { expect, openHostContext, test } from './helpers/host-auth'

async function openHostMenu(page: Page) {
  await page.getByRole('button', { name: 'Настройки' }).click()
}

test('replay shows content-route guidance on a new bill', async ({
  browser,
}) => {
  const { context, page } = await openHostContext(browser)

  await openHostMenu(page)
  await page.getByRole('menuitem', { name: 'Помощ и напътствия' }).click()
  await page.getByRole('button', { name: 'Нова сметка' }).click()

  // Shown both in the sticky guidance bar and on the content-route card.
  await expect(
    page.getByText('Изберете как да въведете сметката').first(),
  ).toBeVisible({ timeout: 30_000 })

  await context.close()
})

test('dev reset welcome sheet can be dismissed', async ({ browser }) => {
  const { context, page } = await openHostContext(browser)

  await page.evaluate(async () => {
    const reset = (
      window as Window & { __e2eResetHostOnboarding?: () => Promise<void> }
    ).__e2eResetHostOnboarding
    if (!reset) {
      throw new Error(
        '__e2eResetHostOnboarding missing — E2E must run via Vite dev (pnpm run dev / test:e2e webServer)',
      )
    }
    await reset()
  })

  await expect(
    page.getByRole('heading', { name: 'Вече имате сметки' }),
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('textbox')).toHaveCount(0)

  // The sheet also has an icon-only „Затвори“ in its corner.
  await page.getByRole('button', { name: 'Затвори' }).first().click()

  await expect(
    page.getByRole('heading', { name: 'Вече имате сметки' }),
  ).not.toBeVisible()

  await context.close()
})
