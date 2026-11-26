import type { Page } from '@playwright/test'
import {
  BILL_RECEIPT_MESSAGES,
  MAX_RECEIPTS_PER_BILL,
} from '../shared/bill-receipts'
import { addBillItem, expectBillItemVisible } from './helpers/bill-editor'
import { expect, openHostContext, test } from './helpers/host-auth'

// No OCR here: photos go up and come off, nothing is read, so the run is free
// and deterministic. Scanning is covered in convex/receiptScan.test.ts.

/** A 1×1 PNG: the app uploads it as is; nothing decodes it but the browser. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
)

function photos(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `receipt-${index + 1}.png`,
    mimeType: 'image/png',
    buffer: PNG,
  }))
}

function receiptStrip(page: Page) {
  return page.getByRole('list', { name: 'Снимки на бележки' })
}

/** Thumbnails are named „Бележка N от M“ (plus a suffix once imported). */
function thumbnails(page: Page, count: number) {
  return receiptStrip(page).getByRole('button', {
    name: new RegExp(`^Бележка \\d+ от ${count}`),
  })
}

async function openNewBill(page: Page) {
  await page.getByRole('button', { name: 'Нова сметка' }).click()
  await page.waitForURL(/\/bills\//)
}

async function pickFromEmptyGallery(page: Page, count: number) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'От галерията' }).click(),
  ])
  expect(chooser.isMultiple()).toBe(true)
  await chooser.setFiles(photos(count))
}

/** „Още бележка“ → one of its two menu items opens a file chooser. */
async function chooserFromAddTile(page: Page, item: 'Снимай' | 'От галерията') {
  await receiptStrip(page).getByRole('button', { name: 'Още бележка' }).click()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: item }).click(),
  ])
  return chooser
}

test('several receipt photos at once; one comes off, the lines stay', async ({
  browser,
}) => {
  const { context, page } = await openHostContext(browser)
  await openNewBill(page)
  await pickFromEmptyGallery(page, 3)

  await expect(thumbnails(page, 3)).toHaveCount(3, { timeout: 30_000 })
  for (const n of [1, 2, 3]) {
    await expect(
      receiptStrip(page).getByRole('button', { name: `Бележка ${n} от 3` }),
    ).toBeVisible()
  }
  // One toast for the whole batch.
  await expect(page.getByText('Качени са 3 снимки')).toHaveCount(1)
  await expect(
    page.getByRole('button', { name: 'Разпознай редовете' }),
  ).toBeVisible()
  await addBillItem(page, { name: 'Бира', price: '4.00', quantity: 2 })

  // Отказ keeps the photo and the viewer open.
  await receiptStrip(page)
    .getByRole('button', { name: 'Бележка 2 от 3' })
    .click()
  const viewer = page.getByRole('dialog', { name: 'Бележка 2 от 3' })
  await expect(viewer.getByText('Още не е разпозната.')).toBeVisible()
  await viewer.getByRole('button', { name: 'Премахни снимката' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('Редовете от нея остават в сметката.')
  await confirm.getByRole('button', { name: 'Отказ' }).click()
  await expect(confirm).toBeHidden()
  await expect(viewer).toBeVisible()

  await viewer.getByRole('button', { name: 'Премахни снимката' }).click()
  await confirm.getByRole('button', { name: 'Премахни снимката' }).click()
  await expect(viewer).toBeHidden()
  await expect(page.getByText('Снимката е премахната')).toBeVisible()
  await expect(thumbnails(page, 2)).toHaveCount(2)
  await expectBillItemVisible(page, 'Бира')

  await context.close()
})

test('„Още бележка“ offers camera and gallery, and stops at the cap', async ({
  browser,
}) => {
  const { context, page } = await openHostContext(browser)
  await openNewBill(page)
  await pickFromEmptyGallery(page, 1)
  await expect(thumbnails(page, 1)).toHaveCount(1, { timeout: 30_000 })

  const camera = await chooserFromAddTile(page, 'Снимай')
  expect(camera.isMultiple()).toBe(false)
  // Close the chooser by picking nothing.
  await camera.setFiles([])

  // Pick more than fit: what fits goes up, the rest is called out.
  const room = MAX_RECEIPTS_PER_BILL - 1
  const gallery = await chooserFromAddTile(page, 'От галерията')
  expect(gallery.isMultiple()).toBe(true)
  await gallery.setFiles(photos(room + 2))

  await expect(thumbnails(page, MAX_RECEIPTS_PER_BILL)).toHaveCount(
    MAX_RECEIPTS_PER_BILL,
    { timeout: 60_000 },
  )
  await expect(page.getByText(`Качени са ${room} снимки`)).toBeVisible()
  await expect(
    page.getByText(`2 снимки не се събраха. ${BILL_RECEIPT_MESSAGES.tooMany}`),
  ).toBeVisible()
  await expect(
    receiptStrip(page).getByRole('button', { name: 'Още бележка' }),
  ).toHaveCount(0)

  await context.close()
})
