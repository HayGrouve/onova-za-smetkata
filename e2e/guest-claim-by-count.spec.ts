import {
  addBillItem,
  addBillParticipants,
  getJoinUrl,
} from './helpers/bill-editor'
import { claimGroup, joinAsGuest, takeUnit } from './helpers/guest'
import { expect, openHostContext, test } from './helpers/host-auth'

test('guests taking the same drink by count never split a unit', async ({
  browser,
}) => {
  const stamp = Date.now()
  const ani = `Ани ${stamp}`
  const bobi = `Боби ${stamp}`

  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)
  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await addBillParticipants(hostPage, [ani, bobi])
  await addBillItem(hostPage, { name: 'Бира', price: '3.00', quantity: 4 })
  const joinUrl = await getJoinUrl(hostPage)

  const guestA = await joinAsGuest(browser, joinUrl, ani)
  const guestB = await joinAsGuest(browser, joinUrl, bobi)

  // Both phones tap the line at the same moment, twice.
  for (const expected of ['1', '2']) {
    await Promise.all([
      takeUnit(guestA.page, 'Бира'),
      takeUnit(guestB.page, 'Бира'),
    ])
    for (const page of [guestA.page, guestB.page]) {
      await expect(
        claimGroup(page, 'Бира').locator('[data-testid^="claim-count-"]'),
      ).toHaveText(expected)
    }
  }

  for (const page of [guestA.page, guestB.page]) {
    const row = claimGroup(page, 'Бира')
    // Every Unit taken, none of them split between the two phones.
    await expect(row.locator('[data-free]')).toHaveCount(0)
    await expect(row.getByText(/делите с/)).toHaveCount(0)
    await expect(page.getByTestId('claim-pay-bar-amount')).toHaveText(/6,00/)
    await expect(page.getByText('Неотбелязани от никого')).toHaveCount(0)
  }

  await guestA.context.close()
  await guestB.context.close()
  await hostContext.close()
})
