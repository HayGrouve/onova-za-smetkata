import { expect, type Page } from '@playwright/test'

/** Bill id from the current URL (ignores ?search and #hash). */
export function billIdFromUrl(url: string): string | undefined {
  return url.match(/\/bills\/([^/?]+)/)?.[1]
}

export async function goToBillStep(hostPage: Page, step: 2 | 3 | 4) {
  const labels = ['Бележка', 'Участници', 'Разпределение', 'Преглед'] as const
  await hostPage.getByLabel(`Стъпка ${step}: ${labels[step - 1]}`).click()
}

/** Auto-added host participant name (first chip on step 2). */
export async function getHostParticipantName(hostPage: Page): Promise<string> {
  const section = hostPage.getByLabel('Участници на сметката')
  const firstChip = section.locator('.rounded-full').first()
  await expect(firstChip).toBeVisible({ timeout: 30_000 })
  const text = await firstChip.innerText()
  return text.trim()
}

/** Item names render in inputs on step 3, not as plain text. */
export async function expectBillItemVisible(page: Page, itemName: string) {
  await expect(
    page.getByRole('button', { name: `Изтрий ${itemName}` }),
  ).toBeVisible()
}

/** Assign the first item's units to named participants (skips host and other chips). */
export async function assignFirstItemToParticipants(
  page: Page,
  participantNames: string[],
) {
  for (const name of participantNames) {
    await page.getByRole('button', { name, exact: true }).click()
  }
}

/** Assign the first item's quantity evenly across participants from the host editor. */
export async function splitFirstItemEvenly(page: Page) {
  await page
    .getByRole('button', { name: 'Раздели поравно', exact: true })
    .first()
    .click()
}
