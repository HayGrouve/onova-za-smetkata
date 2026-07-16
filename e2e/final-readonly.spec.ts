import type { Page } from '@playwright/test'
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

async function claimItem(page: Page, itemName: string) {
  await page.getByRole('button', { name: new RegExp(itemName) }).click()
  await expect(page.getByText('Разбивка на дяла')).toBeVisible()
}

function participantRow(page: Page, participantName: string) {
  return page
    .locator('div.rounded-lg.border')
    .filter({ has: page.getByText(participantName, { exact: true }) })
}

test('finalized bill is read-only on guest claim page', async ({ browser }) => {
  const { context: hostContext, page: hostPage } = await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()

  const restaurantName = `E2E ${Date.now()}`
  await hostPage.getByLabel('Ресторант').fill(restaurantName)

  const participantName = `Final ${Date.now()}`
  await hostPage.getByPlaceholder('Име на участник').fill(participantName)
  await hostPage.getByRole('button', { name: 'Добави' }).click()

  await hostPage.getByPlaceholder('Наименование на артикул').fill('Кафе')
  await hostPage.getByPlaceholder('Цена (€)').first().fill('3.00')
  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()

  const billId = hostPage.url().match(/\/bills\/([^/]+)/)?.[1]
  expect(billId).toBeTruthy()

  const joinUrl = await getJoinUrl(hostPage)

  await hostPage.getByRole('link', { name: 'Преглед' }).click()
  await expect(hostPage).toHaveURL(new RegExp(`/bills/${billId}/summary`))
  await hostPage.getByRole('button', { name: 'Завърши сметка' }).click()
  await expect(hostPage.getByText('Завършена')).toBeVisible()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(joinUrl)
  await guestPage.getByRole('button', { name: participantName }).click()

  await expect(guestPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await expect(
    guestPage.getByText('Сметката е приключена — само преглед.'),
  ).toBeVisible()
  await expect(guestPage.getByRole('button', { name: /Кафе/ })).toBeDisabled()

  await hostContext.close()
  await guestContext.close()
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

  await goToBillStep(hostPage, 2)
  await hostPage.getByPlaceholder('Име на участник').fill(guestName)
  await hostPage.getByRole('button', { name: 'Добави' }).click()
  await expect(hostPage.getByText(guestName)).toBeVisible()

  const joinUrl = await getJoinUrl(hostPage)
  const billId = hostPage.url().match(/\/bills\/([^/?]+)/)?.[1]
  expect(billId).toBeTruthy()

  await goToBillStep(hostPage, 3)
  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill(itemName)
  await hostPage.getByPlaceholder('Цена (€)').first().fill('3.00')
  await hostPage.getByRole('button', { name: 'Добави' }).click()
  await expect(hostPage.getByText(itemName)).toBeVisible()

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
