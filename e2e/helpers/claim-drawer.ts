import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Collapse the claim share drawer back to peek (handle toggle, then scrim). */
export async function collapseClaimShareDrawer(page: Page) {
  const details = page.getByTestId('claim-share-details')
  if (!(await details.isVisible())) return

  const handle = page.getByRole('button', { name: /Разбивка на дяла/ })
  if ((await handle.getAttribute('aria-expanded')) === 'true') {
    await handle.click()
  } else {
    await page.getByRole('button', { name: 'Свий разбивката' }).click()
  }
  await expect(details).toBeHidden()
}

/** Expand the claim share drawer so combined-pay chips and breakdown are visible. */
export async function expandClaimShareDrawer(page: Page) {
  const details = page.getByTestId('claim-share-details')
  if (await details.isVisible()) return
  const handle = page.getByRole('button', { name: /Разбивка на дяла/ })
  await handle.click()
  await expect(details).toBeVisible()
  await expect(handle).toHaveAttribute('aria-expanded', 'true')
}

/** Toggle a combined-pay chip and wait for the server-backed combined request. */
export async function selectCombinedPayChip(
  page: Page,
  participantName: string,
) {
  await expandClaimShareDrawer(page)
  const chip = page
    .getByTestId('claim-share-details')
    .getByRole('button', { name: participantName, exact: true })
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Общо за плащане')).toBeVisible()
}

/** Open Revolut and wait until the pending-transfer state is shown. */
export async function initiateRevolutPayment(page: Page) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Revolut' }).click()
    await expect(page.getByText('Чака потвърждение от домакина')).toBeVisible({
      timeout: 2_000,
    })
  }).toPass({ timeout: 20_000 })
}
