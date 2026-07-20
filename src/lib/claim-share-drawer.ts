export const CLAIM_SHARE_EXPANDED_FRACTION = 0.7
export const CLAIM_SHARE_EXPANDED_MAX_REM = 36

/** Expanded snap/panel height: min(70% viewport, 36rem). */
export function claimShareExpandedHeightPx(
  viewportHeightPx: number,
  rootFontSizePx: number,
): number {
  return Math.min(
    viewportHeightPx * CLAIM_SHARE_EXPANDED_FRACTION,
    CLAIM_SHARE_EXPANDED_MAX_REM * rootFontSizePx,
  )
}

export function buildClaimShareSnapPoints(
  peekHeightPx: number,
  expandedHeightPx: number,
): Array<number | string> {
  const peek = `${Math.round(peekHeightPx)}px`
  const expanded = `${Math.round(expandedHeightPx)}px`
  return [peek, expanded]
}

/** Vaul bottom-drawer translateY: windowHeight − snapHeight. */
export function claimShareSnapOffsetPx(
  viewportHeightPx: number,
  snapHeightPx: number,
): number {
  return viewportHeightPx - snapHeightPx
}

export function isClaimShareExpanded(
  activeSnapPoint: number | string | null,
  snapPoints: Array<number | string>,
): boolean {
  if (activeSnapPoint == null) return false
  return activeSnapPoint === snapPoints[1]
}
