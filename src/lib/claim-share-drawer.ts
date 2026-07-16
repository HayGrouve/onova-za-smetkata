export const CLAIM_SHARE_EXPANDED_FRACTION = 0.7

export function buildClaimShareSnapPoints(
  peekHeightPx: number,
): Array<number | string> {
  const peek = `${Math.round(peekHeightPx)}px`
  return [peek, CLAIM_SHARE_EXPANDED_FRACTION]
}

export function isClaimShareExpanded(
  activeSnapPoint: number | string | null,
  snapPoints: Array<number | string>,
): boolean {
  if (activeSnapPoint == null) return false
  return activeSnapPoint === snapPoints[1]
}
