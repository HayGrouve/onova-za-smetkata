import { createContext, lazy, useContext, useState } from 'react'
import { useHostAuth } from '#/hooks/use-host-auth.ts'
import {
  MountOnFirstOpen,
  usePreloadWhenIdle,
} from '#/components/lazy-sheet.tsx'

const loadFriendGroupsSheet = () =>
  import('#/components/bills/friend-groups-sheet.tsx')
const loadFriendGroupEditorSheet = () =>
  import('#/components/bills/friend-group-editor-sheet.tsx')
const FriendGroupsSheet = lazy(() =>
  loadFriendGroupsSheet().then((m) => ({ default: m.FriendGroupsSheet })),
)
const FriendGroupEditorSheet = lazy(() =>
  loadFriendGroupEditorSheet().then((m) => ({
    default: m.FriendGroupEditorSheet,
  })),
)

const SHEET_LOADERS = [loadFriendGroupsSheet, loadFriendGroupEditorSheet]

interface FriendGroupsContextValue {
  openFriendGroups: () => void
  openNewFriendGroup: (options?: {
    memberNames?: string[]
    suggestedName?: string
  }) => void
}

const FriendGroupsContext = createContext<FriendGroupsContextValue | null>(null)

export function FriendGroupsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { isSignedIn } = useHostAuth()
  usePreloadWhenIdle(Boolean(isSignedIn), SHEET_LOADERS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMemberNames, setEditorMemberNames] = useState<string[]>([])
  const [editorSuggestedName, setEditorSuggestedName] = useState('')

  return (
    <FriendGroupsContext.Provider
      value={{
        openFriendGroups: () => setSettingsOpen(true),
        openNewFriendGroup: (options) => {
          setEditorMemberNames(options?.memberNames ?? [])
          setEditorSuggestedName(options?.suggestedName ?? '')
          setEditorOpen(true)
        },
      }}
    >
      {children}
      <MountOnFirstOpen open={settingsOpen}>
        <FriendGroupsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      </MountOnFirstOpen>
      <MountOnFirstOpen open={editorOpen}>
        <FriendGroupEditorSheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          initialMemberNames={editorMemberNames}
          initialName={editorSuggestedName}
        />
      </MountOnFirstOpen>
    </FriendGroupsContext.Provider>
  )
}

export function useFriendGroups(): FriendGroupsContextValue {
  const context = useContext(FriendGroupsContext)
  if (!context) {
    throw new Error('useFriendGroups must be used within FriendGroupsProvider')
  }
  return context
}

export function useFriendGroupsSheet(): Pick<
  FriendGroupsContextValue,
  'openFriendGroups'
> {
  return useFriendGroups()
}
