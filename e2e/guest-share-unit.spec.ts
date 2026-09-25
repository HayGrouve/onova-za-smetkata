import {
  addBillItem,
  addBillParticipants,
  getJoinUrl,
} from './helpers/bill-editor'
import { claimGroup, joinAsGuest } from './helpers/guest'
import { expect, openHostContext, test } from './helpers/host-auth'

test('sharing a drink puts half of it on the friend right away', async ({
  browser,
}) => {
  const stamp = Date.now()
  const ani = `Ани ${stamp}`
  const bobi = `Боби ${stamp}`

  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)
  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await addBillParticipants(hostPage, [ani, bobi])
  await addBillItem(hostPage, { name: 'Голяма бира', price: '8.00' })
  const joinUrl = await getJoinUrl(hostPage)

  const guestA = await joinAsGuest(browser, joinUrl, ani)
  const rowA = claimGroup(guestA.page, 'Голяма бира')
  await rowA.getByRole('button', { name: 'Мое: Голяма бира' }).click()
  await rowA.getByRole('button', { name: 'Сподели' }).click()

  const sheet = guestA.page.getByTestId('share-unit-sheet')
  await sheet.getByRole('button', { name: bobi }).click()
  await expect(sheet.getByText(/вие плащате 4,00/)).toBeVisible()
  await sheet.getByRole('button', { name: 'Сподели', exact: true }).click()

  await expect(rowA.getByText(`Споделено с ${bobi}`)).toBeVisible()
  await expect(guestA.page.getByTestId('claim-pay-bar-amount')).toHaveText(
    /4,00/,
  )

  const guestB = await joinAsGuest(browser, joinUrl, bobi)
  await expect(
    claimGroup(guestB.page, 'Голяма бира').getByText(`Споделено с ${ani}`),
  ).toBeVisible()
  await expect(guestB.page.getByTestId('claim-pay-bar-amount')).toHaveText(
    /4,00/,
  )

  await guestA.context.close()
  await guestB.context.close()
  await hostContext.close()
})
