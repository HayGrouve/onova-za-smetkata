import { expect, test } from '@playwright/test'
import { HUB_PRIVACY_URL, HUB_TERMS_URL } from '../src/lib/hub-links'

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

test('/privacy and /terms answer 308 to the hub, keeping #smetkata', async ({
  request,
}) => {
  for (const [path, target] of [
    ['/privacy', HUB_PRIVACY_URL],
    ['/terms', HUB_TERMS_URL],
  ]) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(308)
    expect(response.headers().location, path).toBe(target)
  }
})

test('/user-profile/* answers 308 to /abonament with the query', async ({
  request,
}) => {
  const response = await request.get(
    '/user-profile/subscription?checkout=success&session_id=x',
    { maxRedirects: 0 },
  )
  expect(response.status()).toBe(308)
  expect(response.headers().location).toBe(
    '/abonament?checkout=success&session_id=x',
  )

  const bare = await request.get('/user-profile', { maxRedirects: 0 })
  expect(bare.status()).toBe(308)
  expect(bare.headers().location).toBe('/abonament')
})
