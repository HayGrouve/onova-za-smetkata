import { describe, expect, it } from 'vitest'
import {
  needsHeicConversion,
  resolveUploadContentType,
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

describe('resolveUploadContentType', () => {
  it('falls back to extension for empty mime', () => {
    const file = new File(['x'], 'photo.heic', { type: '' })
    expect(resolveUploadContentType(file)).toBe('image/heic')
  })

  it('uses file mime when present', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    expect(resolveUploadContentType(file)).toBe('image/jpeg')
  })
})
