import { describe, expect, it } from 'vitest'
import {
  RECEIPT_IMAGE_MAX_BYTES,
  RECEIPT_IMAGE_MESSAGES,
  receiptImageProblem,
} from './receipt-image'

describe('receiptImageProblem', () => {
  it('accepts the photo types a phone produces', () => {
    for (const type of [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
    ]) {
      expect(receiptImageProblem({ size: 3_000_000, type })).toBeNull()
    }
  })

  it('refuses drawings and formats the scanner cannot read', () => {
    for (const type of ['image/svg+xml', 'image/gif', 'image/tiff', '']) {
      expect(receiptImageProblem({ size: 1000, type })).toBe(
        RECEIPT_IMAGE_MESSAGES.unsupported,
      )
    }
  })

  it('refuses a photo too big to send for reading', () => {
    expect(
      receiptImageProblem({
        size: RECEIPT_IMAGE_MAX_BYTES,
        type: 'image/jpeg',
      }),
    ).toBeNull()
    expect(
      receiptImageProblem({
        size: RECEIPT_IMAGE_MAX_BYTES + 1,
        type: 'image/jpeg',
      }),
    ).toBe(RECEIPT_IMAGE_MESSAGES.tooLarge)
  })
})
