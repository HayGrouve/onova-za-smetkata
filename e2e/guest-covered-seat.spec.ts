import {
  addBillItem,
  addBillParticipants,
  getJoinUrl,
  goToBillStep,
} from './helpers/bill-editor'
import {
  claimGroup,
  goToPayStep,
  initiateRevolutPayment,
  joinAsGuest,
} from './helpers/guest'
import { expect, openHostContext, test } from './helpers/host-auth'
import { configureRevolut } from './helpers/payment-settings'

test('one phone claims and pays for two seats', async ({ browser }) => {
  const stamp = Date.now()
  const ani = `Ани ${stamp}`
  const bobi = `Боби ${stamp}`
  const viki = `Вики ${stamp}`

  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)
  // Payment settings live in the home-page menu.
  await configureRevolut(hostPage)
  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await addBillParticipants(hostPage, [ani, bobi, viki])
  await addBillItem(hostPage, { name: 'Пица', price: '10.00', quantity: 3 })
  const joinUrl = await getJoinUrl(hostPage)

  const payer = await joinAsGuest(browser, joinUrl, ani, [bobi])

  // Another phone sees Боби held by Ани's phone.
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await otherPage.goto(joinUrl)
  await expect(
    otherPage.getByRole('button', { name: `${bobi} — с ${ani}` }),
  ).toBeDisabled()
  await other.close()

  const pizza = () => claimGroup(payer.page, 'Пица')
  await pizza().getByRole('button', { name: 'Още една Пица' }).click()
  await expect(pizza().locator('[data-testid^="claim-count-"]')).toHaveText('1')

  await payer.page.getByRole('tab', { name: bobi }).click()
  await pizza().getByRole('button', { name: 'Още една Пица' }).click()
  await expect(pizza().locator('[data-testid^="claim-count-"]')).toHaveText('1')
  await expect(pizza().getByText(`${ani} 1`)).toBeVisible()

  await expect(payer.page.getByText(`Общо за ${ani} и ${bobi}`)).toBeVisible()
  await expect(payer.page.getByTestId('claim-pay-bar-amount')).toHaveText(
    /20,00/,
  )

  await goToPayStep(payer.page)
  await expect(payer.page.getByTestId('pay-free-units-warning')).toBeVisible()
  await expect(payer.page.getByTestId('pay-total')).toHaveText(/20,00/)
  await initiateRevolutPayment(payer.page)

  await goToBillStep(hostPage, 4)
  const banner = hostPage.getByText(new RegExp(`${ani} плати 20,00`))
  await expect(banner).toBeVisible({ timeout: 15_000 })
  await hostPage.getByRole('button', { name: 'Потвърди' }).first().click()
  await hostPage
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Потвърди' })
    .click()
  await expect(banner).not.toBeVisible({ timeout: 15_000 })

  await payer.context.close()
  await hostContext.close()
})
