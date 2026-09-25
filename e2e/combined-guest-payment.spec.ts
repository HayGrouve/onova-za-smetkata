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

test('host banner hidden until guest opens Revolut', async ({ browser }) => {
  const stamp = Date.now()
  const participantA = `Alice ${stamp}`
  const participantB = `Bob ${stamp}`

  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)
  // Payment settings live in the home-page menu.
  await configureRevolut(hostPage)
  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await addBillParticipants(hostPage, [participantA, participantB])
  await addBillItem(hostPage, { name: 'Пица', price: '5.00', quantity: 2 })
  const joinUrl = await getJoinUrl(hostPage)

  const guestB = await joinAsGuest(browser, joinUrl, participantB)
  await claimGroup(guestB.page, 'Пица')
    .getByRole('button', { name: 'Още една Пица' })
    .click()

  const guestA = await joinAsGuest(browser, joinUrl, participantA)
  await claimGroup(guestA.page, 'Пица')
    .getByRole('button', { name: 'Още една Пица' })
    .click()
  await goToPayStep(guestA.page)
  await guestA.page.getByRole('button', { name: participantB }).click()
  await expect(guestA.page.getByTestId('pay-total')).toHaveText(/10,00/)

  // Bob's phone learns that Alice is paying for him.
  await expect(
    guestB.page.getByText(`${participantA} ще плати и за вас`),
  ).toBeVisible({
    timeout: 15_000,
  })

  await goToBillStep(hostPage, 4)
  const banner = hostPage.getByText(new RegExp(`${participantA}.*плати`))
  await expect(banner).not.toBeVisible()

  await initiateRevolutPayment(guestA.page)
  await expect(banner).toBeVisible({ timeout: 15_000 })

  await guestA.context.close()
  await guestB.context.close()
  await hostContext.close()
})
