import { claimQty1Item } from './helpers/claim-drawer'
import { billIdFromUrl, expectBillItemVisible, goToBillStep } from './helpers/bill-editor'
import { expect, openHostContext, test } from './helpers/host-auth'

async function getJoinUrl(hostPage: import('@playwright/test').Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}

test('guest can claim an item after host setup', async ({ browser }) => {
  const { context: hostContext, page: hostPage } = await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()

  await goToBillStep(hostPage, 2)
  await expect(hostPage.getByPlaceholder('Име на участник')).toBeVisible({
    timeout: 30_000,
  })

  const participantName = `Guest ${Date.now()}`
  await hostPage.getByPlaceholder('Име на участник').fill(participantName)
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expect(hostPage.getByText(participantName)).toBeVisible()

  const joinUrl = await getJoinUrl(hostPage)

  await goToBillStep(hostPage, 3)
  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill('Салата')
  await hostPage.getByPlaceholder('Цена (€)').first().fill('5.00')
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expectBillItemVisible(hostPage, 'Салата')

  const billId = billIdFromUrl(hostPage.url())
  expect(billId).toBeTruthy()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(joinUrl)

  await expect(
    guestPage.getByRole('heading', { name: 'Кой сте вие?' }),
  ).toBeVisible({
    timeout: 30_000,
  })
  await guestPage.getByRole('button', { name: participantName }).click()

  await expect(guestPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await claimQty1Item(guestPage, 'Салата')

  await expect(guestPage.getByText('Разбивка на дяла')).toBeVisible()
  await expect(guestPage.locator('.guest-total-pulse')).toContainText('5,00')

  await hostContext.close()
  await guestContext.close()
})
