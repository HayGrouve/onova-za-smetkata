import type { Browser, Page } from '@playwright/test'
import {
  assignFirstItemToParticipants,
  expectBillItemVisible,
  goToBillStep,
} from './helpers/bill-editor'
import {
  selectCombinedPayChip,
  initiateRevolutPayment,
} from './helpers/claim-drawer'
import { expect, openHostContext, test } from './helpers/host-auth'

async function getJoinUrl(hostPage: Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}

async function configureRevolut(hostPage: Page, username = 'e2etestuser') {
  await hostPage.getByRole('button', { name: 'Настройки' }).click()
  await hostPage.getByRole('menuitem', { name: 'Настройки за плащане' }).click()
  await hostPage.getByLabel('Revolut потребителско име').fill(username)
  await hostPage.getByRole('button', { name: 'Запази' }).click()
  await expect(hostPage.getByText('Настройките са запазени')).toBeVisible()
}

interface CombinedPaySetup {
  hostContext: Awaited<ReturnType<typeof openHostContext>>['context']
  hostPage: Page
  billId: string
  joinUrl: string
  participantA: string
  participantB: string
  itemName: string
}

async function setupCombinedPaymentBill(
  browser: Browser,
): Promise<CombinedPaySetup> {
  const stamp = Date.now()
  const participantA = `Alice ${stamp}`
  const participantB = `Bob ${stamp}`
  const itemName = 'Пица'

  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await goToBillStep(hostPage, 2)

  await expect(hostPage.getByPlaceholder('Име на участник')).toBeVisible({
    timeout: 30_000,
  })

  for (const name of [participantA, participantB]) {
    await hostPage.getByPlaceholder('Име на участник').fill(name)
    await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
    await expect(hostPage.getByText(name)).toBeVisible()
  }

  const joinUrl = await getJoinUrl(hostPage)

  await goToBillStep(hostPage, 3)

  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill(itemName)
  await hostPage.getByPlaceholder('Цена (€)').first().fill('5.00')
  await hostPage.getByLabel('Бр.').fill('2')
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expectBillItemVisible(hostPage, itemName)

  await configureRevolut(hostPage)

  const billId = hostPage.url().match(/\/bills\/([^/?]+)/)?.[1]
  expect(billId).toBeTruthy()

  await assignFirstItemToParticipants(hostPage, [participantA, participantB])

  return {
    hostContext,
    hostPage,
    billId: billId!,
    joinUrl,
    participantA,
    participantB,
    itemName,
  }
}

test('host banner hidden until guest opens Revolut', async ({ browser }) => {
  const setup = await setupCombinedPaymentBill(browser)
  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(setup.joinUrl)
  await expect(
    guestPage.getByRole('heading', { name: 'Кой сте вие?' }),
  ).toBeVisible({ timeout: 30_000 })
  await guestPage.getByRole('button', { name: setup.participantA }).click()
  await expect(guestPage).toHaveURL(new RegExp(`/bills/${setup.billId}/claim`))
  await selectCombinedPayChip(guestPage, setup.participantB)

  await goToBillStep(setup.hostPage, 4)
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).not.toBeVisible()

  await initiateRevolutPayment(guestPage)
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).toBeVisible({ timeout: 15_000 })

  await guestContext.close()
  await setup.hostContext.close()
})
