import { expect } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

/** Open the join link in a fresh guest browser and pick a name (plus Covered seats). */
export async function joinAsGuest(
  browser: Browser,
  joinUrl: string,
  name: string,
  coveredNames: string[] = [],
) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(joinUrl)
  await expect(page.getByRole('heading', { name: 'Кой сте вие?' })).toBeVisible(
    { timeout: 30_000 },
  )
  await page.getByRole('button', { name, exact: true }).click()

  const onlyMe = page.getByRole('button', { name: 'Продължи само за мен' })
  const claimHeading = page.getByRole('heading', {
    name: 'Какво консумирахте?',
  })
  await expect(onlyMe.or(claimHeading)).toBeVisible({ timeout: 30_000 })

  if (await onlyMe.isVisible()) {
    for (const covered of coveredNames) {
      await page.getByRole('button', { name: covered, exact: true }).click()
    }
    await page.getByRole('button', { name: /^Продължи/ }).click()
  }

  await expect(claimHeading).toBeVisible({ timeout: 30_000 })
  return { context, page }
}

export function claimGroup(page: Page, itemName: string) {
  return page.locator('.guest-claim-card').filter({ hasText: itemName })
}

export async function goToPayStep(page: Page) {
  await page.getByRole('button', { name: 'Към плащане' }).click()
  await expect(
    page.getByRole('heading', { name: 'Преглед и плащане' }),
  ).toBeVisible()
}

/** Open Revolut and wait until the pending-transfer state is shown. */
export async function initiateRevolutPayment(page: Page) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Плати с Revolut' }).click()
    await expect(page.getByText('Чака потвърждение от домакина')).toBeVisible({
      timeout: 2_000,
    })
  }).toPass({ timeout: 20_000 })
}
