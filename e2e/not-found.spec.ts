import { expect, test } from '@playwright/test'

test('unknown URL answers 404 with the not-found page', async ({ page }) => {
  const response = await page.goto('/no-such-page/at-all')
  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole('heading', { name: 'Страницата не е намерена' }),
  ).toBeVisible()
  await expect(page).toHaveTitle(/Страницата не е намерена/)

  await page.getByRole('link', { name: 'Към началото' }).click()
  await expect(page).not.toHaveURL(/no-such-page/)
})

test('known public pages still answer 200', async ({ page }) => {
  for (const path of ['/privacy', '/terms', '/login']) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
  }
})
