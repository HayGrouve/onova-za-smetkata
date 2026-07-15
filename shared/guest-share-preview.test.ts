import { describe, expect, it } from 'vitest'
import { previewShareCents, formatShareParticipantCount } from './guest-share-preview'

describe('previewShareCents', () => {
  it('returns full line when unclaimed solo', () => {
    expect(previewShareCents(900, [], 'p1', true)).toBe(900)
  })

  it('previews join into 2-way split', () => {
    expect(previewShareCents(900, ['p2'], 'p1', true)).toBe(450)
  })

  it('shows actual share for 3 assignees', () => {
    expect(previewShareCents(900, ['p1', 'p2', 'p3'], 'p2', false)).toBe(300)
  })

  it('distributes cent remainder like splitLineTotal', () => {
    expect(previewShareCents(1000, ['p1', 'p2'], 'p3', true)).toBe(333)
  })
})

describe('formatShareParticipantCount', () => {
  it('formats Bulgarian count', () => {
    expect(formatShareParticipantCount(2)).toBe('2 души')
    expect(formatShareParticipantCount(1)).toBe('1 човек')
  })
})
