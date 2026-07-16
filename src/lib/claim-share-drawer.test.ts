import { describe, expect, it } from 'vitest'
import {
  CLAIM_SHARE_EXPANDED_FRACTION,
  buildClaimShareSnapPoints,
  isClaimShareExpanded,
} from './claim-share-drawer'

describe('buildClaimShareSnapPoints', () => {
  it('uses rounded px for peek and fraction for expanded', () => {
    expect(buildClaimShareSnapPoints(142.7)).toEqual([
      '143px',
      CLAIM_SHARE_EXPANDED_FRACTION,
    ])
  })
})

describe('isClaimShareExpanded', () => {
  const snaps = buildClaimShareSnapPoints(120)

  it('is false on peek snap', () => {
    expect(isClaimShareExpanded(snaps[0]!, snaps)).toBe(false)
  })

  it('is true on expanded snap', () => {
    expect(isClaimShareExpanded(snaps[1]!, snaps)).toBe(true)
  })

  it('is false when active is null', () => {
    expect(isClaimShareExpanded(null, snaps)).toBe(false)
  })
})
