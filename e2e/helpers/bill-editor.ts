import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Bill id from the current URL (ignores ?search and #hash). */
export function billIdFromUrl(url: string): string | undefined {
  return url.match(/\/bills\/([^/?]+)/)?.[1]
}

export async function goToBillStep(hostPage: Page, step: 1 | 2 | 3 | 4) {
  const labels = ['Сметка', 'Участници', 'Разпределение', 'Плащания'] as const
  await hostPage.getByLabel(`Стъпка ${step}: ${labels[step - 1]}`).click()
}

/** Item rows open the edit sheet; their accessible name is „Редактирай …“. */
export async function expectBillItemVisible(page: Page, itemName: string) {
  await expect(
    page.getByRole('button', { name: `Редактирай ${itemName}` }).first(),
  ).toBeVisible()
}

export async function addBillParticipants(page: Page, names: string[]) {
  await goToBillStep(page, 2)
  const input = page.getByPlaceholder('Име на участник')
  await expect(input).toBeVisible({ timeout: 30_000 })
  for (const name of names) {
    await input.fill(name)
    await page.getByRole('button', { name: 'Добави', exact: true }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
}

export async function addBillItem(
  page: Page,
  item: { name: string; price: string; quantity?: number },
) {
  await goToBillStep(page, 1)
  await page
    .getByRole('button', { name: /^(Добави артикул|Въведи артикул ръчно)$/ })
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
