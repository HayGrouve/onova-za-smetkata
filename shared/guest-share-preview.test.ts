import { describe, expect, it } from 'vitest'
import {
  previewShareCents,
  formatShareParticipantCount,
} from './guest-share-preview'

const participants = [
  { id: 'p1', sortOrder: 0 },
  { id: 'p2', sortOrder: 1 },
  { id: 'p3', sortOrder: 2 },
]

describe('previewShareCents', () => {
  it('returns full line when unclaimed solo', () => {
    expect(previewShareCents(900, [], 'p1', true, participants)).toBe(900)
  })

  it('previews join into 2-way split', () => {
    expect(previewShareCents(900, ['p2'], 'p1', true, participants)).toBe(450)
  })

  it('shows actual share for 3 assignees', () => {
    expect(
      previewShareCents(900, ['p1', 'p2', 'p3'], 'p2', false, participants),
    ).toBe(300)
  })

  it('distributes cent remainder by participant sortOrder', () => {
    const order = [
      { id: 'p3', sortOrder: 0 },
      { id: 'p1', sortOrder: 1 },
      { id: 'p2', sortOrder: 2 },
    ]
    expect(previewShareCents(1000, ['p1', 'p2'], 'p3', true, order)).toBe(334)
  })
})

describe('formatShareParticipantCount', () => {
  it('formats Bulgarian count', () => {
    expect(formatShareParticipantCount(2)).toBe('2 души')
    expect(formatShareParticipantCount(1)).toBe('1 човек')
  })
})
