import {
  addBillItem,
  addBillParticipants,
  getJoinUrl,
  goToBillStep,
} from './helpers/bill-editor'
import {
  goToPayStep,
  initiateRevolutPayment,
  joinAsGuest,
  takeUnit,
} from './helpers/guest'
import { expect, openHostContext, test } from './helpers/host-auth'
import { configureRevolut } from './helpers/payment-settings'

test('a bill from the first line to finalized: guest pays by Revolut, host paints and takes cash', async ({
  browser,
}) => {
  const stamp = Date.now()
  const ani = `Ани ${stamp}`
  const bobi = `Боби ${stamp}`

  // Сглобяване: restaurant, people, one line of two beers.
  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)
  await configureRevolut(hostPage)
  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await hostPage.waitForURL(/\/bills\//)
  const restaurant = hostPage.locator('#restaurantName')
  await restaurant.fill(`Механа ${stamp}`)
  await restaurant.blur()
  await addBillParticipants(hostPage, [ani, bobi])
  await addBillItem(hostPage, { name: 'Бира', price: '4.00', quantity: 2 })
  const joinUrl = await getJoinUrl(hostPage)

  // На масата: Ани claims from her phone and sends the money.
  const guest = await joinAsGuest(browser, joinUrl, ani)
  await takeUnit(guest.page, 'Бира')
  await expect(guest.page.getByTestId('claim-pay-bar-amount')).toHaveText(
    /4,00/,
  )
  await goToPayStep(guest.page)
  await expect(guest.page.getByTestId('pay-total')).toHaveText(/4,00/)
  await initiateRevolutPayment(guest.page)

  // Боби has no phone: the Host paints the last beer for him.
  await goToBillStep(hostPage, 3)
  await hostPage
    .getByRole('group', { name: 'Изберете човек' })
    .first()
    .getByRole('button', { name: new RegExp(`Изберете ${bobi}`) })
    .first()
    .click()
  await hostPage
    .getByRole('button', { name: /^Бира,/ })
    .first()
    .click()
  await expect(hostPage.getByText('Всичко е разпределено.')).toBeVisible({
    timeout: 15_000,
  })

  // Разплащане: confirm Ани's transfer, take Боби's cash, finalize.
  await hostPage.getByRole('button', { name: 'Към разплащане' }).click()
  const banner = hostPage.getByText(new RegExp(`${ani} плати 4,00`))
  await expect(banner).toBeVisible({ timeout: 15_000 })
  await hostPage.getByRole('button', { name: 'Потвърди' }).first().click()
  await expect(banner).toBeHidden({ timeout: 15_000 })
  await hostPage
    .getByRole('button', { name: new RegExp(`Отбележи ${bobi} като платил`) })
    .first()
    .click()

  const finalize = hostPage.getByRole('button', {
    name: 'Приключи',
    exact: true,
  })
  await expect(finalize.first()).toBeEnabled({ timeout: 15_000 })
  await finalize.first().click()
  await hostPage
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Приключи' })
    .click()
  await hostPage.waitForURL(/summary/, { timeout: 20_000 })
  await expect(hostPage.getByText('Приключена').first()).toBeVisible()

  await guest.context.close()
  await hostContext.close()
})
