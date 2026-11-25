import { useClerk, useUser } from '@clerk/tanstack-react-start'
import { LogOutIcon, UserRoundIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { HUB_AKAUNT_URL } from '#/lib/hub-links.ts'

const HOST_AVATAR_MENU_LABEL = 'Твоят Акаунт'

/**
 * The Host's avatar: "Акаунт" (managed on the hub) and "Изход", nothing more
 * (ADR 0005). Calls Clerk hooks, so render it only on Host pages.
 */
export function HostAvatarMenu() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const initial = (user?.firstName ?? user?.username ?? '').slice(0, 1)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full tap-feedback"
          aria-label={HOST_AVATAR_MENU_LABEL}
        >
          <Avatar className="size-8">
            {user?.imageUrl ? <AvatarImage src={user.imageUrl} alt="" /> : null}
            <AvatarFallback className="text-[12px] font-semibold uppercase">
              {initial || <UserRoundIcon className="size-4" aria-hidden />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 [&_[data-slot=dropdown-menu-item]]:cursor-pointer"
      >
        <DropdownMenuItem asChild>
          <a href={HUB_AKAUNT_URL}>
            <UserRoundIcon className={ICON.button} aria-hidden />
            Акаунт
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut({ redirectUrl: '/' })}>
          <LogOutIcon className={ICON.button} aria-hidden />
          Изход
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
