import { expect, openHostContext, test } from './helpers/host-auth'

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
  await page.getByRole('menuitem', { name: 'Още настройки' }).click()
  await page.getByRole('menuitem', { name: 'Профил' }).click()
  await expect(page.getByRole('heading', { name: 'Профил' })).toBeVisible()
  await expect(page).toHaveURL(/\/user-profile/)
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
