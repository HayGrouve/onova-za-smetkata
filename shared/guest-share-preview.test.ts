import { describe, expect, it } from 'vitest'
import { formatShareParticipantCount } from './guest-share-preview'

describe('formatShareParticipantCount', () => {
  it('formats Bulgarian count', () => {
    expect(formatShareParticipantCount(2)).toBe('2 души')
    expect(formatShareParticipantCount(1)).toBe('1 човек')
  })
})
