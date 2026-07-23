import { expect, type Page } from '@playwright/test'

/** Bill id from the current URL (ignores ?search and #hash). */
export function billIdFromUrl(url: string): string | undefined {
  return url.match(/\/bills\/([^/?]+)/)?.[1]
}

export async function goToBillStep(hostPage: Page, step: 2 | 3 | 4) {
  const labels = ['Бележка', 'Участници', 'Разпределение', 'Преглед'] as const
  await hostPage.getByLabel(`Стъпка ${step}: ${labels[step - 1]}`).click()
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
  const firstChip = page.getByRole('button', {
    name: participantNames[0],
    exact: true,
  })
  if ((await firstChip.count()) > 0 && (await firstChip.isVisible())) {
    for (const name of participantNames) {
      await page.getByRole('button', { name, exact: true }).click()
    }
    return
  }

  // Multi-qty items use per-item even split instead of participant chips.
  await page
    .getByRole('button', { name: 'Раздели поравно', exact: true })
    .first()
    .click()
}
