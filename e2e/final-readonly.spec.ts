import type { Page } from '@playwright/test'
import {
  billIdFromUrl,
  expectBillItemVisible,
  getHostParticipantName,
  goToBillStep,
} from './helpers/bill-editor'
import { claimQty1Item } from './helpers/claim-drawer'
import { expect, openHostContext, test } from './helpers/host-auth'

async function getJoinUrl(hostPage: Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}

async function claimItem(page: Page, itemName: string) {
  await claimQty1Item(page, itemName)
}

function participantRow(page: Page, participantName: string) {
  return page
    .locator('div.rounded-lg.border')
    .filter({ has: page.getByText(participantName, { exact: true }) })
}

test('finalized bill is read-only on guest claim page', async ({ browser }) => {
  const stamp = Date.now()
  const participantName = `Final ${stamp}`
  const itemName = 'Кафе'
  const restaurantName = `E2E ${stamp}`

  const { context: hostContext, page: hostPage } = await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await hostPage.getByLabel('Ресторант').fill(restaurantName)
  await hostPage.getByLabel('Ресторант').blur()

  await goToBillStep(hostPage, 2)
  await hostPage.getByPlaceholder('Име на участник').fill(participantName)
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expect(hostPage.getByText(participantName)).toBeVisible()

  const joinUrl = await getJoinUrl(hostPage)
  const billId = billIdFromUrl(hostPage.url())
  expect(billId).toBeTruthy()

  await goToBillStep(hostPage, 3)
  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill(itemName)
  await hostPage.getByPlaceholder('Цена (€)').first().fill('3.00')
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expectBillItemVisible(hostPage, itemName)

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(joinUrl)
  await guestPage.getByRole('button', { name: participantName }).click()
  await expect(guestPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await claimItem(guestPage, itemName)
  await guestContext.close()

  await goToBillStep(hostPage, 4)
  const guestRow = participantRow(hostPage, participantName)
  await guestRow.getByRole('button', { name: 'Платено' }).click()

  await hostPage.getByRole('button', { name: 'Завърши сметка' }).click()
  await hostPage
    .getByRole('dialog')
    .getByRole('button', { name: 'Завърши сметка' })
    .click()
  await expect(hostPage.getByText(/Завършена/)).toBeVisible()

  const guestReadonlyContext = await browser.newContext()
  const guestReadonlyPage = await guestReadonlyContext.newPage()
  await guestReadonlyPage.goto(joinUrl)
  await guestReadonlyPage.getByRole('button', { name: participantName }).click()

  await expect(guestReadonlyPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await expect(
    guestReadonlyPage.getByText('Сметката е приключена — само преглед.'),
  ).toBeVisible()
  await expect(guestReadonlyPage.getByRole('button', { name: /Кафе/ })).toBeDisabled()

  await hostContext.close()
  await guestReadonlyContext.close()
})

test('finalized bill hides payment undo for host and keeps delete', async ({
  browser,
}) => {
  const stamp = Date.now()
  const guestName = `FinalPay ${stamp}`
  const itemName = 'Кафе'
  const restaurantName = `E2E Final Pay ${stamp}`

  const { context: hostContext, page: hostPage } = await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await hostPage.getByLabel('Ресторант').fill(restaurantName)
  await hostPage.getByLabel('Ресторант').blur()

  await goToBillStep(hostPage, 2)
  await hostPage.getByPlaceholder('Име на участник').fill(guestName)
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expect(hostPage.getByText(guestName)).toBeVisible()

  const joinUrl = await getJoinUrl(hostPage)
  const billId = billIdFromUrl(hostPage.url())
  expect(billId).toBeTruthy()

  await goToBillStep(hostPage, 3)
  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill(itemName)
  await hostPage.getByPlaceholder('Цена (€)').first().fill('3.00')
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expectBillItemVisible(hostPage, itemName)

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(joinUrl)
  await guestPage.getByRole('button', { name: guestName }).click()
  await expect(guestPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await claimItem(guestPage, itemName)
  await guestContext.close()

  await goToBillStep(hostPage, 4)
  const guestRow = participantRow(hostPage, guestName)
  await guestRow.getByRole('button', { name: 'Платено' }).click()
  await expect(
    guestRow.getByRole('button', { name: 'Отмени последно плащане' }),
  ).toBeVisible()

  await hostPage.getByRole('button', { name: 'Завърши сметка' }).click()
  await hostPage
    .getByRole('dialog')
    .getByRole('button', { name: 'Завърши сметка' })
    .click()
  await expect(hostPage.getByText(/Завършена/)).toBeVisible()

  await expect(
    hostPage.getByRole('button', { name: 'Отмени последно плащане' }),
  ).toHaveCount(0)
  await expect(hostPage.getByRole('button', { name: 'Платено' })).toHaveCount(0)
  await expect(hostPage.getByRole('button', { name: 'Изтрий' })).toBeVisible()

  await hostContext.close()
})
