import { describe, expect, it } from 'vitest'
import {
  CLAIM_SHARE_EXPANDED_FRACTION,
  CLAIM_SHARE_EXPANDED_MAX_REM,
  buildClaimShareSnapPoints,
  claimShareExpandedHeightPx,
  claimShareSnapOffsetPx,
  isClaimShareExpanded,
} from './claim-share-drawer'

describe('claimShareExpandedHeightPx', () => {
  it('uses 70% of viewport when under the 36rem cap', () => {
    expect(claimShareExpandedHeightPx(800, 16)).toBe(
      800 * CLAIM_SHARE_EXPANDED_FRACTION,
    )
  })

  it('caps at 36rem on tall viewports', () => {
    expect(claimShareExpandedHeightPx(1266, 16)).toBe(
      CLAIM_SHARE_EXPANDED_MAX_REM * 16,
    )
  })
})

describe('buildClaimShareSnapPoints', () => {
  it('uses rounded px for peek and expanded', () => {
    expect(buildClaimShareSnapPoints(142.7, 575.4)).toEqual(['143px', '575px'])
  })
})

describe('isClaimShareExpanded', () => {
  const snaps = buildClaimShareSnapPoints(120, 560)

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

describe('claimShareSnapOffsetPx', () => {
  it('matches Vaul bottom-drawer translateY (viewport − snap)', () => {
    expect(claimShareSnapOffsetPx(727, 160)).toBe(567)
    expect(claimShareSnapOffsetPx(727, 509)).toBe(218)
  })
})
