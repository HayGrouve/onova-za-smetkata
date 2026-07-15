import type { Browser, Page } from '@playwright/test'
import { expect, openHostContext, test } from './helpers/host-auth'

async function getJoinUrl(hostPage: Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}

async function goToBillStep(hostPage: Page, step: 2 | 3 | 4) {
  const labels = ['Бележка', 'Участници', 'Разпределение', 'Преглед'] as const
  await hostPage.getByLabel(`Стъпка ${step}: ${labels[step - 1]}`).click()
}

async function configureRevolut(hostPage: Page, username = 'e2etestuser') {
  await hostPage.getByRole('button', { name: 'Настройки' }).click()
  await hostPage.getByRole('menuitem', { name: 'Настройки за плащане' }).click()
  await hostPage.getByLabel('Revolut потребителско име').fill(username)
  await hostPage.getByRole('button', { name: 'Запази' }).click()
  await expect(hostPage.getByText('Настройките са запазени')).toBeVisible()
}

async function claimHalfOfItem(guestPage: Page, itemName: string) {
  const itemRow = guestPage
    .locator('.guest-claim-card')
    .filter({ hasText: itemName })
  await itemRow.getByLabel('Увеличи').click()
  await expect(guestPage.getByText('Разбивка на дяла')).toBeVisible()
}

async function assertParticipantPaid(hostPage: Page, participantName: string) {
  const row = hostPage
    .locator('div.rounded-lg.border')
    .filter({ has: hostPage.getByText(participantName, { exact: true }) })
  await expect(row.getByText('платено')).toBeVisible()
  await expect(row.getByText('Остатък').locator('..')).toContainText('€0.00')
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

  const { context: hostContext, page: hostPage } = await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await goToBillStep(hostPage, 2)

  await expect(hostPage.getByText('Участници')).toBeVisible({ timeout: 30_000 })

  for (const name of [participantA, participantB]) {
    await hostPage.getByPlaceholder('Име на участник').fill(name)
    await hostPage.getByRole('button', { name: 'Добави' }).click()
    await expect(hostPage.getByText(name)).toBeVisible()
  }

  const joinUrl = await getJoinUrl(hostPage)

  await goToBillStep(hostPage, 3)

  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill(itemName)
  await hostPage.getByPlaceholder('Цена (€)').first().fill('5.00')
  await hostPage.getByLabel('Бр.').fill('2')
  await hostPage.getByRole('button', { name: 'Добави' }).click()
  await expect(hostPage.getByText(itemName)).toBeVisible()

  await configureRevolut(hostPage)

  const billId = hostPage.url().match(/\/bills\/([^/?]+)/)?.[1]
  expect(billId).toBeTruthy()

  const guestAContext = await browser.newContext()
  const guestAPage = await guestAContext.newPage()
  await guestAPage.goto(joinUrl)
  await expect(
    guestAPage.getByRole('heading', { name: 'Кой сте вие?' }),
  ).toBeVisible({ timeout: 30_000 })
  await guestAPage.getByRole('button', { name: participantA }).click()
  await expect(guestAPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await claimHalfOfItem(guestAPage, itemName)

  const guestBContext = await browser.newContext()
  const guestBPage = await guestBContext.newPage()
  await guestBPage.goto(joinUrl)
  await guestBPage.getByRole('button', { name: participantB }).click()
  await expect(guestBPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await claimHalfOfItem(guestBPage, itemName)
  await guestBContext.close()
  await guestAContext.close()

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

async function startGuestCombinedPayment(
  browser: Browser,
  setup: CombinedPaySetup,
) {
  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(setup.joinUrl)
  await guestPage.getByRole('button', { name: setup.participantA }).click()
  await expect(guestPage).toHaveURL(
    new RegExp(`/bills/${setup.billId}/claim`),
  )
  await expect(guestPage.getByText('Разбивка на дяла')).toBeVisible()

  await guestPage.getByRole('button', { name: setup.participantB }).click()
  await expect(guestPage.getByText('Общо за плащане')).toBeVisible()

  await guestPage.getByRole('button', { name: 'Revolut' }).click()
  await expect(
    guestPage.getByText('Чака потвърждение от домакина'),
  ).toBeVisible({ timeout: 15_000 })

  return { guestContext, guestPage }
}

test('host banner hidden until guest opens Revolut', async ({ browser }) => {
  const setup = await setupCombinedPaymentBill(browser)
  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(setup.joinUrl)
  await guestPage.getByRole('button', { name: setup.participantA }).click()
  await guestPage.getByRole('button', { name: setup.participantB }).click()

  await goToBillStep(setup.hostPage, 4)
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).not.toBeVisible()

  await guestPage.getByRole('button', { name: 'Revolut' }).click()
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).toBeVisible({ timeout: 15_000 })

  await guestContext.close()
  await setup.hostContext.close()
})

test('guest solo pay — host confirms one', async ({ browser }) => {
  const setup = await setupCombinedPaymentBill(browser)

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(setup.joinUrl)
  await guestPage.getByRole('button', { name: setup.participantA }).click()
  await claimHalfOfItem(guestPage, setup.itemName)

  await guestPage.getByRole('button', { name: 'Revolut' }).click()
  await expect(
    guestPage.getByText('Чака потвърждение от домакина'),
  ).toBeVisible({ timeout: 15_000 })

  await goToBillStep(setup.hostPage, 4)
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).toBeVisible({ timeout: 15_000 })

  await setup.hostPage
    .locator('[class*="border-accent"]')
    .getByRole('button', { name: 'Потвърди' })
    .click()
  await setup.hostPage
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Потвърди' })
    .click()

  await assertParticipantPaid(setup.hostPage, setup.participantA)

  await guestContext.close()
  await setup.hostContext.close()
})

test('guest combined pay flow — host confirms both', async ({ browser }) => {
  const setup = await setupCombinedPaymentBill(browser)
  const { guestContext, guestPage } = await startGuestCombinedPayment(
    browser,
    setup,
  )

  await goToBillStep(setup.hostPage, 4)
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).toBeVisible({ timeout: 15_000 })

  await setup.hostPage
    .locator('[class*="border-accent"]')
    .getByRole('button', { name: 'Потвърди' })
    .click()
  await setup.hostPage
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Потвърди' })
    .click()

  await assertParticipantPaid(setup.hostPage, setup.participantA)
  await assertParticipantPaid(setup.hostPage, setup.participantB)

  await setup.hostContext.close()
  await guestContext.close()
})

test('guest can cancel pending combined payment', async ({ browser }) => {
  const setup = await setupCombinedPaymentBill(browser)
  const { guestContext, guestPage } = await startGuestCombinedPayment(
    browser,
    setup,
  )

  await goToBillStep(setup.hostPage, 4)
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).toBeVisible({ timeout: 15_000 })

  await guestPage.getByRole('button', { name: 'Отмени' }).click()
  await expect(
    guestPage.getByText('Чака потвърждение от домакина'),
  ).not.toBeVisible()

  await setup.hostPage.reload()
  await expect(
    setup.hostPage.getByRole('button', { name: 'Отхвърли' }),
  ).not.toBeVisible()
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).not.toBeVisible()

  await setup.hostContext.close()
  await guestContext.close()
})
