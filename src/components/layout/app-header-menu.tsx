import { useAuthActions } from '@convex-dev/auth/react'
import {
  CogIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  MoreVerticalIcon,
  SunIcon,
  UsersIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { useFriendGroupsSheet } from '#/components/bills/friend-groups-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import { ICON } from '#/lib/app-icons.ts'

export interface AppHeaderMenuProps {
  showHostActions: boolean
  viewerLabel?: string | null
  viewerEmail?: string | null
}

export function AppHeaderMenu({
  showHostActions,
  viewerLabel,
  viewerEmail,
}: AppHeaderMenuProps) {
  const { theme, setTheme } = useTheme()
  const { signOut } = useAuthActions()
  const { openPaymentSettings } = usePaymentSettingsSheet()
  const { openFriendGroups } = useFriendGroupsSheet()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleSignOut() {
    await signOut()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 tap-feedback"
          aria-label="Настройки"
        >
          <MoreVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {showHostActions && viewerLabel ? (
          <>
            <DropdownMenuLabel
              className="truncate font-normal text-muted-foreground"
              title={viewerEmail ?? viewerLabel}
            >
              {viewerLabel}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {mounted ? (
          <DropdownMenuRadioGroup
            value={theme ?? 'system'}
            onValueChange={setTheme}
          >
            <DropdownMenuRadioItem value="light">
              <SunIcon className={ICON.button} aria-hidden />
              Светла тема
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <MoonIcon className={ICON.button} aria-hidden />
              Тъмна тема
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <MonitorIcon className={ICON.button} aria-hidden />
              Системна тема
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        ) : null}
        {showHostActions ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openPaymentSettings()}>
              <CogIcon className={ICON.button} aria-hidden />
              Настройки за плащане
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openFriendGroups()}>
              <UsersIcon className={ICON.button} aria-hidden />
              Моите групи
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void handleSignOut()}
            >
              <LogOutIcon className={ICON.button} aria-hidden />
              Изход
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
