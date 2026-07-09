/** Host routes that show AppFooter (not login, join, or claim). */
export function isHostShellRoute(pathname: string): boolean {
  if (pathname === '/login') return false
  if (pathname.endsWith('/join')) return false
  if (pathname.endsWith('/claim')) return false
  if (pathname === '/') return true

  const billRoute = /^\/bills\/[^/]+(\/)?$/
  if (billRoute.test(pathname)) return true

  const summaryRoute = /^\/bills\/[^/]+\/summary$/
  return summaryRoute.test(pathname)
}
