import { expect, openHostContext, test } from './helpers/host-auth'

async function getJoinUrl(hostPage: import('@playwright/test').Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}

test('second guest sees taken participant name', async ({ browser }) => {
  const { context: hostContext, page: hostPage } = await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()

  const participantName = `Taken ${Date.now()}`
  await hostPage.getByPlaceholder('Име на участник').fill(participantName)
  await hostPage.getByRole('button', { name: 'Добави' }).click()
  await expect(hostPage.getByText(participantName)).toBeVisible()

  const billId = hostPage.url().match(/\/bills\/([^/]+)/)?.[1]
  expect(billId).toBeTruthy()

  const joinUrl = await getJoinUrl(hostPage)

  const guestA = await browser.newContext()
  const pageA = await guestA.newPage()
  await pageA.goto(joinUrl)
  await pageA.getByRole('button', { name: participantName }).click()
  await expect(pageA).toHaveURL(new RegExp(`/bills/${billId}/claim`))

  const guestB = await browser.newContext()
  const pageB = await guestB.newPage()
  await pageB.goto(joinUrl)
  await expect(pageB.getByText('Заето')).toBeVisible()
  await expect(
    pageB.getByRole('button', { name: new RegExp(participantName) }),
  ).toBeDisabled()

  await hostContext.close()
  await guestA.close()
  await guestB.close()
})
