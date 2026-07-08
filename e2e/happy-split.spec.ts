import { expect, openHostContext, test } from './helpers/host-auth'

async function getJoinUrl(hostPage: import('@playwright/test').Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}

test('guest can claim an item after host setup', async ({ browser }) => {
  const { context: hostContext, page: hostPage } = await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()

  await expect(hostPage.getByText('Участници')).toBeVisible({ timeout: 30_000 })

  const participantName = `Guest ${Date.now()}`
  await hostPage.getByPlaceholder('Име на участник').fill(participantName)
  await hostPage.getByRole('button', { name: 'Добави' }).click()
  await expect(hostPage.getByText(participantName)).toBeVisible()

  await hostPage.getByPlaceholder('Наименование на артикул').fill('Салата')
  await hostPage.getByPlaceholder('Цена (€)').first().fill('5.00')
  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await expect(hostPage.getByText('Салата')).toBeVisible()

  const billUrl = hostPage.url()
  const billId = billUrl.match(/\/bills\/([^/]+)/)?.[1]
  expect(billId).toBeTruthy()

  const joinUrl = await getJoinUrl(hostPage)

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
  await guestPage.getByRole('button', { name: /Салата/ }).click()

  await expect(guestPage.getByText('Разбивка на дяла')).toBeVisible()
  await expect(guestPage.getByText('€5.00')).toBeVisible()

  await hostContext.close()
  await guestContext.close()
})
