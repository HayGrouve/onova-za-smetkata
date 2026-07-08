import { expect, openHostContext, test } from './helpers/host-auth'

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

  await hostPage.getByRole('link', { name: 'Преглед' }).click()
  await expect(hostPage).toHaveURL(new RegExp(`/bills/${billId}/summary`))
  await hostPage.getByRole('button', { name: 'Завърши сметка' }).click()
  await expect(hostPage.getByText('Завършена')).toBeVisible()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(`/bills/${billId}/join`)
  await guestPage.getByRole('button', { name: participantName }).click()

  await expect(guestPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await expect(
    guestPage.getByText('Сметката е приключена — само преглед.'),
  ).toBeVisible()
  await expect(guestPage.getByRole('button', { name: /Кафе/ })).toBeDisabled()

  await hostContext.close()
  await guestContext.close()
})
