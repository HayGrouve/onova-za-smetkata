import { test } from '@playwright/test'
import { expectSignInBounce } from './helpers/sign-in-bounce'

test('Започни on the landing page bounces to Clerk sign-in, back to /', async ({
  page,
  baseURL,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Започни' }).first().click()
  await expectSignInBounce(page, `${baseURL}/`)
})

test('a signed-out deep link bounces with the full original URL', async ({
  page,
  baseURL,
}) => {
  await page.goto('/bills/x?step=3')
  await expectSignInBounce(page, `${baseURL}/bills/x?step=3`)
})

test('an old /login link still bounces, keeping its redirect', async ({
  page,
  baseURL,
}) => {
  await page.goto('/login?redirect=%2Fquick-bill')
  await expectSignInBounce(page, `${baseURL}/quick-bill`)
})

test('/login never sends anyone off the site', async ({ page, baseURL }) => {
  await page.goto('/login?redirect=%2F%2Fevil.example')
  await expectSignInBounce(page, `${baseURL}/`)
})
