import { describe, expect, it } from 'vitest'
import { needsHeicConversion } from './prepare-receipt-image'

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
