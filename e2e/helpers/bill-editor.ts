import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Bill id from the current URL (ignores ?search and #hash). */
export function billIdFromUrl(url: string): string | undefined {
  return url.match(/\/bills\/([^/?]+)/)?.[1]
}

/**
 * The receipt's phase timeline: steps 1 and 2 are both Сглобяване (the
 * people section is lower on the same paper), 3 is На масата, 4 Разплащане.
 */
export async function goToBillStep(hostPage: Page, step: 1 | 2 | 3 | 4) {
  const phase =
    step === 4 ? 'Разплащане' : step === 3 ? 'На масата' : 'Сглобяване'
  await hostPage
    .getByRole('list', { name: 'Етап на сметката' })
    .getByRole('button', { name: phase })
    .click()
}

/** Item rows open the edit sheet; their accessible name is „Редактирай …“. */
export async function expectBillItemVisible(page: Page, itemName: string) {
  await expect(
    page.getByRole('button', { name: `Редактирай ${itemName}` }).first(),
  ).toBeVisible()
}

/** The name shows up among the people at the table (rail and slips repeat it). */
export async function expectParticipantAdded(page: Page, name: string) {
  await expect(
    page.getByLabel('Участници на сметката').getByText(name),
  ).toBeVisible()
}

export async function addBillParticipants(page: Page, names: string[]) {
  await goToBillStep(page, 2)
  const input = page.getByPlaceholder('Име на участник')
  await expect(input).toBeVisible({ timeout: 30_000 })
  for (const name of names) {
    await input.fill(name)
    await page.getByRole('button', { name: 'Добави', exact: true }).click()
    await expectParticipantAdded(page, name)
  }
}

export async function addBillItem(
  page: Page,
  item: { name: string; price: string; quantity?: number },
) {
  await goToBillStep(page, 1)
  await page
    .getByRole('button', { name: /^(Добави ред|Добави ред на ръка)$/ })
    .click()
  const sheet = page.getByTestId('item-edit-sheet')
  await sheet.locator('#item-name').fill(item.name)
  await sheet.locator('#item-price').fill(item.price)
  await sheet.locator('#item-quantity').fill(String(item.quantity ?? 1))
  await sheet.getByRole('button', { name: 'Добави', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expectBillItemVisible(page, item.name)
}

export async function getJoinUrl(page: Page) {
  await goToBillStep(page, 3)
  const joinUrl = await page.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}
