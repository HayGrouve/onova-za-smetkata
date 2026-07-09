import { createContext, useContext, useState } from 'react'
import { FriendGroupsSheet } from '#/components/bills/friend-groups-sheet.tsx'
import { FriendGroupEditorSheet } from '#/components/bills/friend-group-editor-sheet.tsx'

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
      <FriendGroupsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <FriendGroupEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialMemberNames={editorMemberNames}
        initialName={editorSuggestedName}
      />
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
