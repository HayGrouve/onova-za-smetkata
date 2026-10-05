import { describe, expect, it } from 'vitest'
import {
  RECEIPT_IMAGE_MAX_BYTES,
  RECEIPT_IMAGE_MESSAGES,
} from '../../shared/receipt-image'
import {
  needsHeicConversion,
  prepareReceiptImage,
} from './prepare-receipt-image'

describe('needsHeicConversion', () => {
  it('detects HEIC mime type', () => {
    const file = new File(['x'], 'photo.heic', { type: 'image/heic' })
    expect(needsHeicConversion(file)).toBe(true)
  })

  it('detects HEIC by extension when mime is empty', () => {
    const file = new File(['x'], 'IMG_1234.HEIC', { type: '' })
    expect(needsHeicConversion(file)).toBe(true)
  })

  it('does not convert JPEG', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    expect(needsHeicConversion(file)).toBe(false)
  })
})

describe('prepareReceiptImage', () => {
  it('passes a phone photo through unchanged', async () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    await expect(prepareReceiptImage(file)).resolves.toEqual({
      blob: file,
      contentType: 'image/png',
    })
  })

  it('uploads a photo some phones label image/jpg as JPEG', async () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpg' })
    await expect(prepareReceiptImage(file)).resolves.toEqual({
      blob: file,
      contentType: 'image/jpeg',
    })
  })

  it('refuses an SVG or GIF before uploading it', async () => {
    for (const [name, type] of [
      ['receipt.svg', 'image/svg+xml'],
      ['receipt.gif', 'image/gif'],
    ]) {
      await expect(
        prepareReceiptImage(new File(['<svg/>'], name, { type })),
      ).rejects.toThrow(RECEIPT_IMAGE_MESSAGES.unsupported)
    }
  })

  it('refuses a photo over the size the scanner can read', async () => {
    const file = new File(
      [new Uint8Array(RECEIPT_IMAGE_MAX_BYTES + 1)],
      'huge.jpg',
      { type: 'image/jpeg' },
    )
    await expect(prepareReceiptImage(file)).rejects.toThrow(
      RECEIPT_IMAGE_MESSAGES.tooLarge,
    )
  })
})
