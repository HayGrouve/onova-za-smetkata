import type { Page } from '@playwright/test'
import {
  billIdFromUrl,
  expectParticipantAdded,
  goToBillStep,
} from './helpers/bill-editor'
import {
  avatarTrigger,
  expect,
  openHostContext,
  test,
} from './helpers/host-auth'
import { expectSignInBounce } from './helpers/sign-in-bounce'
import { HUB_AKAUNT_URL } from '../src/lib/hub-links'

async function expectAvatarLeftOfSettings(page: Page) {
  const avatar = avatarTrigger(page)
  const settings = page.getByRole('button', { name: 'Настройки', exact: true })
  await expect(avatar).toBeVisible({ timeout: 30_000 })
  await expect(settings).toBeVisible()
  const avatarBox = await avatar.boundingBox()
  const settingsBox = await settings.boundingBox()
  expect(avatarBox).toBeTruthy()
  expect(settingsBox).toBeTruthy()
  expect(avatarBox!.x + avatarBox!.width).toBeLessThanOrEqual(
    settingsBox!.x + 1,
  )
}

async function expectThemeRocker(page: Page) {
  await expect(page.getByRole('radio', { name: 'Светла' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Системна' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Тъмна' })).toBeVisible()
}

async function expectHostKebabChrome(page: Page) {
  await expect(page.getByRole('menuitem', { name: 'Профил' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Изход' })).toHaveCount(0)
  await expect(page.locator('[data-slot="dropdown-menu-label"]')).toHaveCount(0)
  await expectThemeRocker(page)
  await expect(
    page.getByRole('menuitem', { name: 'Настройки за плащане' }),
  ).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: 'Моите групи' }),
  ).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Данни' })).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: 'Помощ и напътствия' }),
  ).toBeVisible()
}

test('unsigned /abonament bounces to sign-in and back to /abonament', async ({
  page,
  baseURL,
}) => {
  await page.goto('/abonament')
  await expectSignInBounce(page, `${baseURL}/abonament`)
})

// Needs the billing switch off on the dev deployment (see e2e/README.md).
test('signed-in Host on /abonament goes Home while billing is off', async ({
  browser,
}) => {
  const { context, page } = await openHostContext(browser)

  await page.goto('/abonament?checkout=success&session_id=cs_test')
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Нова сметка' })).toBeVisible()

  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Абонамент' })).toHaveCount(0)

  await context.close()
})

test('an old Checkout return to /user-profile lands on /abonament with the query', async ({
  browser,
  baseURL,
}) => {
  const { context, page } = await openHostContext(browser)

  const response = await page.goto(
    '/user-profile/subscription?checkout=success&session_id=x',
  )
  expect(response?.request().redirectedFrom()?.url()).toBe(
    `${baseURL}/user-profile/subscription?checkout=success&session_id=x`,
  )
  expect(response?.url()).toBe(
    `${baseURL}/abonament?checkout=success&session_id=x`,
  )
  // Billing is off on dev, so /abonament then sends the Host Home.
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 })

  await context.close()
})

test('the avatar menu holds only Акаунт (to the hub) and Изход', async ({
  browser,
}) => {
  const { context, page } = await openHostContext(browser)

  await expectAvatarLeftOfSettings(page)

  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  await expectHostKebabChrome(page)
  await page.keyboard.press('Escape')

  await avatarTrigger(page).click()
  const items = page.getByRole('menuitem')
  await expect(items).toHaveCount(2)
  await expect(page.getByRole('menuitem', { name: 'Акаунт' })).toHaveAttribute(
    'href',
    HUB_AKAUNT_URL,
  )
  await expect(page.getByRole('menuitem', { name: 'Изход' })).toBeVisible()

  await context.close()
})

test('Изход signs the Host out onto the landing page', async ({ browser }) => {
  const { context, page } = await openHostContext(browser)
  await page.goto('/quick-bill')

  await avatarTrigger(page).click()
  await page.getByRole('menuitem', { name: 'Изход' }).click()

  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'Започни' }).first()).toBeVisible(
    { timeout: 30_000 },
  )
  await expect(avatarTrigger(page)).toHaveCount(0)

  await context.close()
})

test('guest join and claim have no avatar; theme stays in the kebab', async ({
  browser,
}) => {
  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await goToBillStep(hostPage, 2)
  await expect(hostPage.getByPlaceholder('Име на участник')).toBeVisible({
    timeout: 30_000,
  })
  const participantName = `Guest ${Date.now()}`
  await hostPage.getByPlaceholder('Име на участник').fill(participantName)
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  await expectParticipantAdded(hostPage, participantName)

  await goToBillStep(hostPage, 3)
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  const billId = billIdFromUrl(hostPage.url())
  expect(billId).toBeTruthy()

  await hostPage.goto(joinUrl!)
  await expect(avatarTrigger(hostPage)).toHaveCount(0)

  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  await guestPage.goto(joinUrl!)
  await expect(avatarTrigger(guestPage)).toHaveCount(0)
  // Retry until hydration settles; an early click can land before React owns the menu.
  await expect(async () => {
    await guestPage
      .getByRole('button', { name: 'Настройки', exact: true })
      .click()
    await expectThemeRocker(guestPage)
  }).toPass({ timeout: 20_000 })
  await expect(
    guestPage.getByRole('menuitem', { name: 'Настройки за плащане' }),
  ).toHaveCount(0)
  await guestPage.keyboard.press('Escape')
  await guestPage.getByRole('button', { name: participantName }).click()
  await expect(guestPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await expect(avatarTrigger(guestPage)).toHaveCount(0)
  await guestPage
    .getByRole('button', { name: 'Настройки', exact: true })
    .click()
  await expectThemeRocker(guestPage)

  await hostContext.close()
  await guest.close()
})
