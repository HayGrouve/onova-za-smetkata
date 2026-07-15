import { createContext, useContext, useState } from 'react'
import { ProfileSheet } from '#/components/profile/profile-sheet.tsx'

interface ProfileContextValue {
  openProfile: () => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <ProfileContext.Provider value={{ openProfile: () => setOpen(true) }}>
      {children}
      <ProfileSheet open={open} onOpenChange={setOpen} />
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider')
  }
  return context
}

export function useProfileSheet(): Pick<ProfileContextValue, 'openProfile'> {
  return useProfile()
}
