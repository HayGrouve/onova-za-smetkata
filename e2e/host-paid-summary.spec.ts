import type { Browser, Page } from '@playwright/test'
import {
  billIdFromUrl,
  expectBillItemVisible,
  getHostParticipantName,
  goToBillStep,
} from './helpers/bill-editor'
import { claimHalfOfItem, goBackFromHostClaim, initiateRevolutPayment } from './helpers/claim-drawer'
import { expect, openHostContext, test } from './helpers/host-auth'

async function getJoinUrl(hostPage: Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}

async function configureRevolut(hostPage: Page, username = 'e2etestuser') {
  await hostPage.getByRole('button', { name: 'Настройки' }).click()
  await hostPage
    .getByRole('menuitem', { name: 'Настройки за плащане' })
    .click({ timeout: 10_000 })
  await hostPage.getByLabel('Revolut потребителско име').fill(username)
  await hostPage.getByRole('button', { name: 'Запази' }).click()
  await expect(hostPage.getByText('Настройките са запазени')).toBeVisible()
}

function participantRow(page: Page, participantName: string) {
  return page
    .locator('div.rounded-lg.border')
    .filter({ has: page.getByText(participantName, { exact: true }) })
}

async function assertHostPaidByRule(hostPage: Page, hostName: string) {
  const row = participantRow(hostPage, hostName)
  await expect(row.getByText('платено')).toBeVisible()
  await expect(row.getByText('Дължи')).toBeVisible()
  await expect(row.getByText('Платено')).toBeVisible()
  await expect(row.getByText('Остатък').locator('..')).toContainText('0,00')
  await expect(row.getByRole('button', { name: 'Платено' })).not.toBeVisible()
  await expect(row.getByRole('button', { name: 'Revolut' })).not.toBeVisible()
  await expect(
    row.getByRole('button', { name: 'Отмени последно плащане' }),
  ).not.toBeVisible()
}

test('host paid-by-rule summary flow', async ({ browser }) => {
  const stamp = Date.now()
  const guestName = `Guest ${stamp}`
  const itemName = 'Салата'

  const { context: hostContext, page: hostPage } = await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await goToBillStep(hostPage, 2)

  await expect(hostPage.getByPlaceholder('Име на участник')).toBeVisible({
    timeout: 30_000,
  })
  const hostName = await getHostParticipantName(hostPage)

  await hostPage.getByPlaceholder('Име на участник').fill(guestName)
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expect(hostPage.getByText(guestName)).toBeVisible()

  const joinUrl = await getJoinUrl(hostPage)

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(joinUrl)
  await expect(
    guestPage.getByRole('heading', { name: 'Кой сте вие?' }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(
    guestPage.getByRole('button', { name: hostName }),
  ).not.toBeVisible()
  await expect(guestPage.getByRole('button', { name: guestName })).toBeVisible()
  await guestContext.close()

  await goToBillStep(hostPage, 3)

  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill(itemName)
  await hostPage.getByPlaceholder('Цена (€)').first().fill('6.00')
  await hostPage.getByLabel('Бр.').fill('2')
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expectBillItemVisible(hostPage, itemName)

  await configureRevolut(hostPage)

  await hostPage.getByRole('button', { name: 'Моите артикули' }).click()
  await expect(hostPage.getByRole('heading', { name: 'Моите артикули' })).toBeVisible()
  await expect(hostPage.getByLabel('Назад')).toBeVisible()
  await claimHalfOfItem(hostPage, itemName)
  await expect(hostPage.getByText('Покрито като домакин')).toBeVisible()

  await goBackFromHostClaim(hostPage)
  await expect(hostPage).toHaveURL(/\/bills\/[^/?]+\/?(?:\?.*)?$/)
  await expect(hostPage.getByRole('button', { name: 'Моите артикули' })).toBeVisible()

  const billId = billIdFromUrl(hostPage.url())
  expect(billId).toBeTruthy()
  await hostPage.goto(`/bills/${billId}`)

  const guestClaimContext = await browser.newContext()
  const guestClaimPage = await guestClaimContext.newPage()
  await guestClaimPage.goto(joinUrl)
  await guestClaimPage.getByRole('button', { name: guestName }).click()
  await expect(guestClaimPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await claimHalfOfItem(guestClaimPage, itemName)
  await expect(guestClaimPage.getByRole('button', { name: 'Revolut' })).toBeVisible()
  await guestClaimContext.close()

  await hostPage.goto(`/bills/${billId}`)
  await goToBillStep(hostPage, 4)

  await expect(hostPage.getByText('0 от 1 платени')).toBeVisible()
  await assertHostPaidByRule(hostPage, hostName)

  const guestRow = participantRow(hostPage, guestName)
  await expect(guestRow.getByText('неплатено')).toBeVisible()
  await expect(guestRow.getByRole('button', { name: 'Платено' })).toBeVisible()
  // Host collects; Revolut pay-to-host belongs on the guest claim footer only.
  await expect(guestRow.getByRole('button', { name: 'Revolut' })).toHaveCount(0)

  await hostContext.close()
})

test('guest Revolut still works after host paid-by-rule setup', async ({
  browser,
}) => {
  const setup = await setupHostGuestBill(browser)
  const { guestContext, guestPage } = await openGuestClaim(
    browser,
    setup.joinUrl,
    setup.guestName,
    setup.billId,
  )

  await initiateRevolutPayment(guestPage)

  await goToBillStep(setup.hostPage, 4)
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.guestName}.*плати`)),
  ).toBeVisible({ timeout: 15_000 })

  await setup.hostPage
    .locator('[class*="border-accent"]')
    .getByRole('button', { name: 'Потвърди' })
    .click()
  await setup.hostPage
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Потвърди' })
    .click()

  const guestRow = participantRow(setup.hostPage, setup.guestName)
  await expect(guestRow.getByText('платено', { exact: true })).toBeVisible()
  await expect(setup.hostPage.getByText('1 от 1 платени')).toBeVisible()
  await assertHostPaidByRule(setup.hostPage, setup.hostName)

  await guestContext.close()
  await setup.hostContext.close()
})

interface HostGuestBillSetup {
  hostContext: Awaited<ReturnType<typeof openHostContext>>['context']
  hostPage: Page
  billId: string
  joinUrl: string
  hostName: string
  guestName: string
  itemName: string
}

async function setupHostGuestBill(browser: Browser): Promise<HostGuestBillSetup> {
  const stamp = Date.now()
  const guestName = `Guest ${stamp}`
  const itemName = 'Пица'

  const { context: hostContext, page: hostPage } = await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await goToBillStep(hostPage, 2)

  const hostName = await getHostParticipantName(hostPage)
  await hostPage.getByPlaceholder('Име на участник').fill(guestName)
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()

  const joinUrl = await getJoinUrl(hostPage)
  await goToBillStep(hostPage, 3)

  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill(itemName)
  await hostPage.getByPlaceholder('Цена (€)').first().fill('4.00')
  await hostPage.getByLabel('Бр.').fill('2')
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()

  await configureRevolut(hostPage)

  await hostPage.getByRole('button', { name: 'Моите артикули' }).click()
  await claimHalfOfItem(hostPage, itemName)

  await goBackFromHostClaim(hostPage)
  await expect(hostPage).toHaveURL(/\/bills\/[^/?]+\/?(?:\?.*)?$/)
  await expect(hostPage.getByRole('button', { name: 'Моите артикули' })).toBeVisible()

  const billId = billIdFromUrl(hostPage.url())
  expect(billId).toBeTruthy()
  await hostPage.goto(`/bills/${billId}`)

  const guestClaimContext = await browser.newContext()
  const guestClaimPage = await guestClaimContext.newPage()
  await guestClaimPage.goto(joinUrl)
  await guestClaimPage.getByRole('button', { name: guestName }).click()
  await claimHalfOfItem(guestClaimPage, itemName)
  await guestClaimContext.close()

  return {
    hostContext,
    hostPage,
    billId: billId!,
    joinUrl,
    hostName,
    guestName,
    itemName,
  }
}

async function openGuestClaim(
  browser: Browser,
  joinUrl: string,
  guestName: string,
  billId: string,
) {
  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(joinUrl)
  await guestPage.getByRole('button', { name: guestName }).click()
  await expect(guestPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  return { guestContext, guestPage }
}
