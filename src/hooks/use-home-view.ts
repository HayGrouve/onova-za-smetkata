import { useHostAuth } from '#/hooks/use-host-auth.ts'

/** What `/` shows: the landing page signed out, the Host's Home signed in. */
export type HomeView = 'loading' | 'landing' | 'home'

/** One answer for the page and the shell (the landing footer sits outside <main>). */
export function useHomeView(): HomeView {
  const { isLoaded, isSignedIn } = useHostAuth()
  if (!isLoaded) return 'loading'
  return isSignedIn ? 'home' : 'landing'
}
