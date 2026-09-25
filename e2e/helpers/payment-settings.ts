import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function configureRevolut(
  hostPage: Page,
  username = 'e2etestuser',
) {
  await hostPage.getByRole('button', { name: 'Настройки', exact: true }).click()
  await hostPage.getByRole('menuitem', { name: 'Настройки за плащане' }).click()
  await hostPage.getByLabel('Revolut потребителско име').fill(username)
  await hostPage.getByRole('button', { name: 'Запази' }).click()
  await expect(hostPage.getByText('Настройките са запазени')).toBeVisible()
}
