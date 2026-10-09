import { createContext, useContext } from 'react'

export interface HostAuthState {
  isLoaded: boolean
  isSignedIn: boolean | undefined
}

/**
 * Host sign-in state for the app shell. Clerk only loads off the Guest pages,
 * so components shared with them read this instead of Clerk's `useAuth`; on a
 * Guest page it is always signed out.
 */
export const HostAuthContext = createContext<HostAuthState>({
  isLoaded: false,
  isSignedIn: undefined,
})

export function useHostAuth(): HostAuthState {
  return useContext(HostAuthContext)
}
