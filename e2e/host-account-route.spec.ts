import type { Locator, Page } from '@playwright/test'
import { billIdFromUrl, goToBillStep } from './helpers/bill-editor'
import { expect, openHostContext, test } from './helpers/host-auth'

function userButtonTrigger(page: Page): Locator {
  return page.locator('.cl-userButtonTrigger')
}

async function expectUserButtonLeftOfSettings(page: Page) {
  const userButton = userButtonTrigger(page)
  const settings = page.getByRole('button', { name: 'Настройки' })
  await expect(userButton).toBeVisible({ timeout: 30_000 })
  await expect(settings).toBeVisible()
  const userBox = await userButton.boundingBox()
  const settingsBox = await settings.boundingBox()
  expect(userBox).toBeTruthy()
  expect(settingsBox).toBeTruthy()
  expect(userBox!.x + userBox!.width).toBeLessThanOrEqual(settingsBox!.x + 1)
}

async function expectThemeRocker(page: Page) {
  await expect(page.getByRole('radio', { name: 'Светла' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Системна' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Тъмна' })).toBeVisible()
}

async function expectHostKebabChrome(page: Page, moreSettingsNested: boolean) {
  await expect(page.getByRole('menuitem', { name: 'Профил' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Изход' })).toHaveCount(0)
  await expect(page.locator('[data-slot="dropdown-menu-label"]')).toHaveCount(0)
  await expectThemeRocker(page)

  if (moreSettingsNested) {
    await page.getByRole('menuitem', { name: 'Още настройки' }).click()
  }

  await expect(
    page.getByRole('menuitem', { name: 'Настройки за плащане' }),
  ).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: 'Моите групи' }),
  ).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: 'Помощ и напътствия' }),
  ).toBeVisible()
}

test('unsigned /user-profile redirects to login with redirect', async ({
  page,
}) => {
  await page.goto('/user-profile')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fuser-profile/)
})

test('signed-in Host can open Акаунт and security without 404', async ({
  browser,
}) => {
  const { context, page } = await openHostContext(browser)

  await page.goto('/user-profile')
  await expect(page.getByRole('heading', { name: 'Акаунт' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('button', { name: 'Назад' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Страницата не е намерена' }),
  ).not.toBeVisible()

  await page.getByRole('button', { name: 'Настройки' }).click()
  await expectHostKebabChrome(page, true)
  await page.keyboard.press('Escape')

  await page.goto('/user-profile/security')
  await expect(page.getByRole('heading', { name: 'Акаунт' })).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('heading', { name: 'Страницата не е намерена' }),
  ).not.toBeVisible()
  await expect(page).toHaveURL(/\/user-profile\/security/)

  await context.close()
})

test('signed-in Host sees UserButton left of kebab; Manage account opens Акаунт', async ({
  browser,
}) => {
  const { context, page } = await openHostContext(browser)

  await expectUserButtonLeftOfSettings(page)

  await page.getByRole('button', { name: 'Настройки' }).click()
  await expectHostKebabChrome(page, false)
  await page.keyboard.press('Escape')

  await userButtonTrigger(page).click()
  await page.getByText('Управление на акаунта', { exact: true }).click()
  await expect(page).toHaveURL(/\/user-profile/)
  await expect(page.getByRole('heading', { name: 'Акаунт' })).toBeVisible({
    timeout: 30_000,
  })

  await context.close()
})

test('guest join and claim have no UserButton; theme stays in the kebab', async ({
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
  await expect(hostPage.getByText(participantName)).toBeVisible()

  await goToBillStep(hostPage, 3)
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  const billId = billIdFromUrl(hostPage.url())
  expect(billId).toBeTruthy()

  await hostPage.goto(joinUrl!)
  await expect(userButtonTrigger(hostPage)).toHaveCount(0)

  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  await guestPage.goto(joinUrl!)
  await expect(userButtonTrigger(guestPage)).toHaveCount(0)
  await guestPage.getByRole('button', { name: 'Настройки' }).click()
  await expectThemeRocker(guestPage)
  await expect(
    guestPage.getByRole('menuitem', { name: 'Настройки за плащане' }),
  ).toHaveCount(0)
  await guestPage.keyboard.press('Escape')
  await guestPage.getByRole('button', { name: participantName }).click()
  await expect(guestPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await expect(userButtonTrigger(guestPage)).toHaveCount(0)
  await guestPage.getByRole('button', { name: 'Настройки' }).click()
  await expectThemeRocker(guestPage)

  await hostContext.close()
  await guest.close()
})
