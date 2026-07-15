import type { Browser, Page } from '@playwright/test'
import { expect, openHostContext, test } from './helpers/host-auth'

async function getJoinUrl(hostPage: Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}

async function goToBillStep(hostPage: Page, step: 2 | 3 | 4) {
  const labels = ['Бележка', 'Участници', 'Разпределение', 'Преглед'] as const
  await hostPage.getByLabel(`Стъпка ${step}: ${labels[step - 1]}`).click()
}

async function joinAsGuest(
  browser: Browser,
  joinUrl: string,
  billId: string,
  participantName: string,
) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(joinUrl)
  await expect(
    page.getByRole('heading', { name: 'Кой сте вие?' }),
  ).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: participantName }).click()
  await expect(page).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  return { context, page }
}

async function claimSharedQty1Item(guestPage: Page, itemName: string) {
  const itemRow = guestPage
    .locator('.guest-claim-card')
    .filter({ hasText: itemName })
  await itemRow.click()
  await expect(guestPage.getByText('Разбивка на дяла')).toBeVisible()
}

test('three guests share one qty=1 item with equal split', async ({ browser }) => {
  const stamp = Date.now()
  const participantA = `Alice ${stamp}`
  const participantB = `Bob ${stamp}`
  const participantC = `Carol ${stamp}`
  const itemName = '1L Напитка'

  const { context: hostContext, page: hostPage } = await openHostContext(browser)
  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await goToBillStep(hostPage, 2)

  for (const name of [participantA, participantB, participantC]) {
    await hostPage.getByPlaceholder('Име на участник').fill(name)
    await hostPage.getByRole('button', { name: 'Добави' }).click()
    await expect(hostPage.getByText(name)).toBeVisible()
  }

  const joinUrl = await getJoinUrl(hostPage)
  await goToBillStep(hostPage, 3)

  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill(itemName)
  await hostPage.getByPlaceholder('Цена (€)').first().fill('9.00')
  await hostPage.getByLabel('Бр.').fill('1')
  await hostPage.getByRole('button', { name: 'Добави' }).click()
  await expect(hostPage.getByText(itemName)).toBeVisible()

  const billId = hostPage.url().match(/\/bills\/([^/?]+)/)?.[1]
  expect(billId).toBeTruthy()

  const guestA = await joinAsGuest(browser, joinUrl, billId!, participantA)
  await claimSharedQty1Item(guestA.page, itemName)
  await expect(guestA.page.getByText('✓ Ваше')).toBeVisible()
  await expect(guestA.page.getByText('Вашият дял: €9.00')).toBeVisible()

  const guestB = await joinAsGuest(browser, joinUrl, billId!, participantB)
  await expect(guestB.page.getByText('Споделено с')).toBeVisible()
  await expect(guestB.page.getByText('Вашият дял: €4.50')).toBeVisible()
  await claimSharedQty1Item(guestB.page, itemName)
  await expect(guestB.page.getByText('Вашият дял: €4.50')).toBeVisible()

  const guestC = await joinAsGuest(browser, joinUrl, billId!, participantC)
  await expect(guestC.page.getByText('Споделено с')).toBeVisible()
  await expect(guestC.page.getByText('Вашият дял: €3.00')).toBeVisible()
  await claimSharedQty1Item(guestC.page, itemName)
  await expect(guestC.page.getByText('Вашият дял: €3.00')).toBeVisible()

  await guestA.context.close()
  await guestB.context.close()
  await guestC.context.close()
  await hostContext.close()
})
