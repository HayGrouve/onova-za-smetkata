import {
  addBillItem,
  addBillParticipants,
  getJoinUrl,
} from './helpers/bill-editor'
import { claimGroup, joinAsGuest } from './helpers/guest'
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

  const plusA = claimGroup(guestA.page, 'Бира').getByRole('button', {
    name: 'Още една Бира',
  })
  const plusB = claimGroup(guestB.page, 'Бира').getByRole('button', {
    name: 'Още една Бира',
  })

  // Both phones press „+“ at the same moment, twice.
  for (const expected of ['1', '2']) {
    await Promise.all([plusA.click(), plusB.click()])
    for (const page of [guestA.page, guestB.page]) {
      await expect(
        claimGroup(page, 'Бира').locator('[data-testid^="claim-count-"]'),
      ).toHaveText(expected)
    }
  }

  for (const page of [guestA.page, guestB.page]) {
    const row = claimGroup(page, 'Бира')
    await expect(row.getByText('Всички са отбелязани')).toBeVisible()
    await expect(row.getByText(/1 бройка с/)).toHaveCount(0)
    await expect(page.getByTestId('claim-pay-bar-amount')).toHaveText(/6,00/)
    await expect(page.getByTestId('table-progress')).toContainText(
      '4 от 4 бройки',
    )
  }

  await guestA.context.close()
  await guestB.context.close()
  await hostContext.close()
})
