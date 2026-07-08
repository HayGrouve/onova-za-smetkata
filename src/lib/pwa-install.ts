export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  )
}

/** iPhone / iPad Safari — no `beforeinstallprompt`; manual Add to Home Screen only. */
export function isIosInstallBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const isClassicIos = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const isIpadOs =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isClassicIos || isIpadOs
}
