import { expect } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

/** Open the join link in a fresh guest browser, pick a name, then add any Covered seats from the claim page. */
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

  // The claim page is the receipt with this phone's slip pinned to it.
  await expect(page.getByTestId('claim-pay-bar-amount').first()).toBeVisible({
    timeout: 30_000,
  })

  if (coveredNames.length > 0) {
    await page
      .getByRole('button', { name: 'Плащам и за някого' })
      .first()
      .click()
    const sheet = page.getByRole('dialog', { name: 'За кого още отбелязвате?' })
    for (const covered of coveredNames) {
      await sheet.getByRole('button', { name: covered, exact: true }).click()
    }
    await sheet.getByRole('button', { name: 'Запази' }).click()
    await expect(sheet).toBeHidden()
  }

  return { context, page }
}

/** A receipt line (Claim group) on the guest's receipt. */
export function claimGroup(page: Page, itemName: string) {
  return page.locator('li[data-line]').filter({ hasText: itemName })
}

/** Tap the line: take one Unit for the seat being marked for. */
export async function takeUnit(page: Page, itemName: string) {
  await claimGroup(page, itemName)
    .getByRole('button', { name: new RegExp(`^Мое: ${itemName},`) })
    .click()
}

/** Tear the slip off: the pay slip with the amount first. */
export async function goToPayStep(page: Page) {
  await page
    .getByRole('button', { name: /Откъсни и плати|Виж плащането/ })
    .first()
    .click()
  await expect(page.getByTestId('pay-total')).toBeVisible()
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
