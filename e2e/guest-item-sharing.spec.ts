import type { Browser, Page } from '@playwright/test'
import { expectBillItemVisible, goToBillStep } from './helpers/bill-editor'
import { claimQty1Item } from './helpers/claim-drawer'
import { expect, openHostContext, test } from './helpers/host-auth'

async function getJoinUrl(hostPage: Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
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
  await claimQty1Item(guestPage, itemName)
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
    await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
    await expect(hostPage.getByText(name)).toBeVisible()
  }

  const joinUrl = await getJoinUrl(hostPage)
  await goToBillStep(hostPage, 3)

  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill(itemName)
  await hostPage.getByPlaceholder('Цена (€)').first().fill('9.00')
  await hostPage.getByLabel('Бр.').fill('1')
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expectBillItemVisible(hostPage, itemName)

  const billId = hostPage.url().match(/\/bills\/([^/?]+)/)?.[1]
  expect(billId).toBeTruthy()

  const guestA = await joinAsGuest(browser, joinUrl, billId!, participantA)
  await claimSharedQty1Item(guestA.page, itemName)
  await expect(guestA.page.getByText('Вашият дял')).toBeVisible()
  await expect(guestA.page.locator('.guest-total-pulse')).toContainText('9,00')

  const guestB = await joinAsGuest(browser, joinUrl, billId!, participantB)
  await expect(guestB.page.getByText('Споделено с')).toBeVisible()
  await expect(guestB.page.getByText('4,50 €').first()).toBeVisible()
  await claimSharedQty1Item(guestB.page, itemName)
  await expect(guestB.page.locator('.guest-total-pulse')).toContainText('4,50')

  const guestC = await joinAsGuest(browser, joinUrl, billId!, participantC)
  await expect(guestC.page.getByText('Споделено с')).toBeVisible()
  await expect(guestC.page.getByText('3,00 €').first()).toBeVisible()
  await claimSharedQty1Item(guestC.page, itemName)
  await expect(guestC.page.locator('.guest-total-pulse')).toContainText('3,00')

  await guestA.context.close()
  await guestB.context.close()
  await guestC.context.close()
  await hostContext.close()
})
