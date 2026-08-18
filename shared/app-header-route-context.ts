import type { AppHeaderRouteContext } from './app-header-menu-config'

export function resolveAppHeaderRouteContext(
  pathname: string,
  searchStr: string,
  billId: string | undefined,
): AppHeaderRouteContext {
  if (pathname === '/') return 'home'
  if (pathname === '/login') return 'login'
  if (pathname === '/user-profile' || pathname.startsWith('/user-profile/')) {
    return 'hostAccount'
  }
  if (!billId) return 'home'

  const isSummary = pathname.endsWith('/summary')
  const isJoin = pathname.endsWith('/join')
  const isClaim = pathname.endsWith('/claim')
  const claimMode = new URLSearchParams(searchStr).get('mode')

  if (isJoin) return 'guestJoin'
  if (isClaim && claimMode !== 'host') return 'guestClaim'
  if (isClaim && claimMode === 'host') return 'hostClaim'
  if (isSummary) return 'summary'
  return 'editor'
}
