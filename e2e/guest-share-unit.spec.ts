import {
  addBillItem,
  addBillParticipants,
  getJoinUrl,
} from './helpers/bill-editor'
import { claimGroup, joinAsGuest, takeUnit } from './helpers/guest'
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
  await takeUnit(guestA.page, 'Голяма бира')
  // „⋯“ on the line opens its Units: share one with a friend.
  await rowA.getByRole('button', { name: 'Бройки на Голяма бира' }).click()
  const drawer = guestA.page.getByRole('region', { name: 'Голяма бира' })
  await drawer.getByRole('button', { name: bobi }).click()
  await expect(drawer.getByText(/вие плащате 4,00/)).toBeVisible()
  await drawer.getByRole('button', { name: 'Сподели 1 бройка' }).click()

  await expect(rowA.getByText(`делите с ${bobi}`)).toBeVisible()
  await expect(guestA.page.getByTestId('claim-pay-bar-amount')).toHaveText(
    /4,00/,
  )

  const guestB = await joinAsGuest(browser, joinUrl, bobi)
  await expect(
    claimGroup(guestB.page, 'Голяма бира').getByText(`делите с ${ani}`),
  ).toBeVisible()
  await expect(guestB.page.getByTestId('claim-pay-bar-amount')).toHaveText(
    /4,00/,
  )

  await guestA.context.close()
  await guestB.context.close()
  await hostContext.close()
})
