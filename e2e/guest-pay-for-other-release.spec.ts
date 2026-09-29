import {
  addBillItem,
  addBillParticipants,
  getJoinUrl,
} from './helpers/bill-editor'
import { claimGroup, goToPayStep, joinAsGuest } from './helpers/guest'
import { expect, openHostContext, test } from './helpers/host-auth'
import { configureRevolut } from './helpers/payment-settings'

test('a pay-for-others pick is freed when that phone leaves', async ({
  browser,
}) => {
  const stamp = Date.now()
  const ani = `Ани ${stamp}`
  const bobi = `Боби ${stamp}`
  const coveredHint = 'Не е нужно да плащате отделно засега.'

  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)
  await configureRevolut(hostPage)
  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await addBillParticipants(hostPage, [ani, bobi])
  await addBillItem(hostPage, { name: 'Бира', price: '4.00', quantity: 2 })
  const joinUrl = await getJoinUrl(hostPage)

  const guestB = await joinAsGuest(browser, joinUrl, bobi)
  const takeBeer = /^(Мое: |Още една )Бира$/
  await claimGroup(guestB.page, 'Бира')
    .getByRole('button', { name: takeBeer })
    .click()

  // Ани picks Боби on the Pay step (a reservation — no transfer yet).
  const guestA = await joinAsGuest(browser, joinUrl, ani)
  await claimGroup(guestA.page, 'Бира')
    .getByRole('button', { name: takeBeer })
    .click()
  await goToPayStep(guestA.page)
  await guestA.page.getByRole('button', { name: new RegExp(bobi) }).click()

  await goToPayStep(guestB.page)
  await expect(guestB.page.getByText(coveredHint)).toBeVisible()

  // Ани closes the bill on her phone without paying.
  await guestA.page.goBack()
  await guestA.page.getByRole('button', { name: `Не съм ${ani}` }).click()

  // Боби can pay for himself again.
  await expect(guestB.page.getByText(coveredHint)).toBeHidden({
    timeout: 15_000,
  })
  await expect(
    guestB.page.getByRole('button', { name: 'Плати с Revolut' }),
  ).toBeEnabled()

  await guestA.context.close()
  await guestB.context.close()
  await hostContext.close()
})
