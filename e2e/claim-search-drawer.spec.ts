import {
  collapseClaimShareDrawer,
  expandClaimShareDrawer,
} from './helpers/claim-drawer'
import {
  billIdFromUrl,
  expectBillItemVisible,
  goToBillStep,
} from './helpers/bill-editor'
import { expect, openHostContext, test } from './helpers/host-auth'
import type { Locator, Page } from '@playwright/test'

async function getJoinUrl(hostPage: Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}

/** True when the topmost hit at the search field center is the input itself. */
async function searchCenterIsHittable(search: Locator) {
  return search.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const top = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    )
    return top != null && (top === el || el.contains(top))
  })
}

test('claim item search stays usable after share drawer expand and collapse', async ({
  browser,
}) => {
  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await goToBillStep(hostPage, 2)
  const participantName = `Guest ${Date.now()}`
  await hostPage.getByPlaceholder('Име на участник').fill(participantName)
  await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
  const joinUrl = await getJoinUrl(hostPage)

  await goToBillStep(hostPage, 3)
  for (const [name, price] of [
    ['Салата', '5.00'],
    ['Бира', '3.00'],
  ] as const) {
    await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
    await hostPage.locator('#new-item-name').fill(name)
    await hostPage.locator('#new-item-price').fill(price)
    await hostPage.getByRole('button', { name: 'Добави', exact: true }).click()
    await expectBillItemVisible(hostPage, name)
  }

  const billId = billIdFromUrl(hostPage.url())
  expect(billId).toBeTruthy()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(joinUrl)
  await guestPage.getByRole('button', { name: participantName }).click()
  await expect(guestPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))

  const search = guestPage.getByPlaceholder('Търсене по артикул')
  await expect(search).toBeVisible()
  await search.fill('Бир')
  await expect(
    guestPage.locator('.guest-claim-card').filter({ hasText: 'Бира' }),
  ).toBeVisible()
  await expect(
    guestPage.locator('.guest-claim-card').filter({ hasText: 'Салата' }),
  ).toHaveCount(0)

  await expandClaimShareDrawer(guestPage)
  await collapseClaimShareDrawer(guestPage)
  await expect(
    guestPage.getByRole('button', { name: /Разбивка на дяла/ }),
  ).toHaveAttribute('aria-expanded', 'false')

  // Wait for Vaul's transform transition so pe-auto header/summary settle in peek.
  await expect
    .poll(() =>
      guestPage.locator('[data-slot="drawer-content"]').evaluate((el) => {
        const top = el.getBoundingClientRect().top
        return top > window.innerHeight * 0.5
      }),
    )
    .toBe(true)

  await expect.poll(() => searchCenterIsHittable(search)).toBe(true)

  // Real pointer click — covers both overlay hit-steal and Vaul focusOutside trap.
  const box = await search.boundingBox()
  expect(box).toBeTruthy()
  await guestPage.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect(search).toBeFocused()
  await search.fill('Сал')
  await expect(search).toHaveValue('Сал')
  await expect(
    guestPage.locator('.guest-claim-card').filter({ hasText: 'Салата' }),
  ).toBeVisible()
  await expect(
    guestPage.locator('.guest-claim-card').filter({ hasText: 'Бира' }),
  ).toHaveCount(0)

  await hostContext.close()
  await guestContext.close()
})
