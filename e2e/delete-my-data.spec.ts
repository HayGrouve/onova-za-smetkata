import { billIdFromUrl } from './helpers/bill-editor'
import { expect, openHostContext, test } from './helpers/host-auth'
import { DELETE_MY_DATA_COPY } from '../src/lib/destructive-action-copy'
import { GUEST_FLOW_MESSAGES } from '../shared/guest-flow-messages'

test('Изтрий данните: typed ИЗТРИЙ wipes the bills and the Host stays signed in', async ({
  browser,
}) => {
  const { context, page } = await openHostContext(browser)

  await page.getByRole('button', { name: 'Нова сметка' }).click()
  await expect(page).toHaveURL(/\/bills\/[^/?]+/, { timeout: 30_000 })
  const billId = billIdFromUrl(page.url())
  expect(billId).toBeTruthy()
  await page.goto('/')

  await page.getByRole('button', { name: 'Настройки', exact: true }).click()
  await page
    .getByRole('menuitem', { name: DELETE_MY_DATA_COPY.menuLabel })
    .click()
  const sheet = page.getByRole('dialog', { name: DELETE_MY_DATA_COPY.title })
  await expect(sheet).toBeVisible({ timeout: 15_000 })
  await expect(
    sheet.getByRole('link', { name: DELETE_MY_DATA_COPY.akauntLink }),
  ).toHaveAttribute('href', DELETE_MY_DATA_COPY.akauntUrl)
  await sheet.getByRole('button', { name: DELETE_MY_DATA_COPY.button }).click()

  const confirm = page.getByRole('alertdialog')
  const confirmButton = confirm.getByRole('button', {
    name: DELETE_MY_DATA_COPY.button,
  })
  const field = confirm.getByLabel('Напиши ИЗТРИЙ')
  await expect(confirmButton).toBeDisabled()
  await field.fill('изтрий')
  await expect(confirmButton).toBeDisabled()
  await field.fill('ИЗТРИЙ')
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()

  await expect(page.getByText(DELETE_MY_DATA_COPY.done)).toBeVisible({
    timeout: 30_000,
  })
  await expect(page).toHaveURL(/\/$/)

  // Still signed in, as a brand new Host: the first-run welcome or Home.
  const newBill = page.getByRole('button', { name: 'Нова сметка' })
  const skipWelcome = page.getByRole('button', { name: 'Не сега' })
  await expect(newBill.or(skipWelcome)).toBeVisible({ timeout: 30_000 })
  if (await skipWelcome.isVisible()) await skipWelcome.click()
  await expect(newBill).toBeVisible()
  await expect(page.locator('.cl-userButtonTrigger')).toBeVisible()

  await page.goto(`/bills/${billId}`)
  await expect(
    page.getByText(GUEST_FLOW_MESSAGES.billNotFound.replace(/\.$/, '')).first(),
  ).toBeVisible({ timeout: 30_000 })

  // The brand new Host can start over. This also leaves the shared e2e user
  // with a bill, so later specs don't race the first-run welcome sheet.
  // The welcome sheet may still slide in over Home; dismiss it and retry.
  await page.goto('/')
  await expect(async () => {
    if (await skipWelcome.isVisible()) await skipWelcome.click()
    await newBill.click({ timeout: 3_000 })
    await expect(page).toHaveURL(/\/bills\/[^/?]+/, { timeout: 5_000 })
  }).toPass({ timeout: 45_000 })
  expect(billIdFromUrl(page.url())).not.toBe(billId)

  await context.close()
})
