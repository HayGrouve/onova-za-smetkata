import { useAuthActions } from '@convex-dev/auth/react'
import {
  BookOpenIcon,
  CheckCircleIcon,
  CogIcon,
  Link2OffIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  MoreVerticalIcon,
  PencilIcon,
  Share2Icon,
  ShareIcon,
  SunIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { useFriendGroupsSheet } from '#/components/bills/friend-groups-provider.tsx'
import { useProfileSheet } from '#/components/profile/profile-provider.tsx'
import { useHostOnboarding } from '#/components/host-onboarding/host-onboarding-provider.tsx'
import { HOST_ONBOARDING_HOME } from '../../../shared/host-onboarding-messages.ts'
import type {
  AppHeaderMenuBillActionId,
  AppHeaderMenuItemDescriptor,
} from '../../../shared/app-header-menu-config.ts'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { getSignOutCopy } from '#/lib/destructive-action-copy.ts'

const BILL_ACTION_ICONS: Record<AppHeaderMenuBillActionId, typeof Share2Icon> =
  {
    shareJoinLink: Share2Icon,
    rotateShareToken: Link2OffIcon,
    finalizeBill: CheckCircleIcon,
    deleteBill: Trash2Icon,
    editBill: PencilIcon,
    shareBillText: ShareIcon,
    goToEditor: PencilIcon,
  }

export interface AppHeaderMenuProps {
  showHostActions: boolean
  viewerLabel?: string | null
  viewerEmail?: string | null
  billMenuItems?: AppHeaderMenuItemDescriptor[]
  onBillAction?: (actionId: AppHeaderMenuBillActionId) => void
  billMenuDialogs?: React.ReactNode
}

function BillMenuItem({
  item,
  onSelect,
}: {
  item: AppHeaderMenuItemDescriptor
  onSelect: () => void
}) {
  const Icon = BILL_ACTION_ICONS[item.id]
  const menuItem = (
    <DropdownMenuItem
      variant={item.variant}
      disabled={item.disabled}
      onSelect={(event) => {
        if (item.disabled) {
          event.preventDefault()
          return
        }
        event.preventDefault()
        onSelect()
      }}
    >
      <Icon className={ICON.button} aria-hidden />
      {item.label}
    </DropdownMenuItem>
  )

  if (item.disabled && item.tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block w-full">{menuItem}</span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-center">
          {item.tooltip}
        </TooltipContent>
      </Tooltip>
    )
  }

  return menuItem
}

export function AppHeaderMenu({
  showHostActions,
  viewerLabel,
  viewerEmail,
  billMenuItems = [],
  onBillAction,
  billMenuDialogs,
}: AppHeaderMenuProps) {
  const { theme, setTheme } = useTheme()
  const { signOut } = useAuthActions()
  const { openPaymentSettings } = usePaymentSettingsSheet()
  const { openFriendGroups } = useFriendGroupsSheet()
  const { openProfile } = useProfileSheet()
  const { startReplay } = useHostOnboarding()
  const { confirm } = useConfirmAction()
  const [mounted, setMounted] = useState(false)

  const visibleBillItems = billMenuItems.filter((item) => !item.hidden)

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleSignOutWithConfirm() {
    const confirmed = await confirm(getSignOutCopy())
    if (!confirmed) return
    await handleSignOut()
  }

  async function handleSignOut() {
    await signOut()
  }

  return (
    <>
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
          {visibleBillItems.length > 0 && onBillAction ? (
            <>
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                Сметка
              </DropdownMenuLabel>
              {visibleBillItems.map((item) => (
                <BillMenuItem
                  key={item.id}
                  item={item}
                  onSelect={() => onBillAction(item.id)}
                />
              ))}
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
              <DropdownMenuItem onSelect={() => openProfile()}>
                <UserIcon className={ICON.button} aria-hidden />
                Профил
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openPaymentSettings()}>
                <CogIcon className={ICON.button} aria-hidden />
                Настройки за плащане
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openFriendGroups()}>
                <UsersIcon className={ICON.button} aria-hidden />
                Моите групи
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => startReplay()}>
                <BookOpenIcon className={ICON.button} aria-hidden />
                {HOST_ONBOARDING_HOME.helpAndGuidance}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault()
                  void handleSignOutWithConfirm()
                }}
              >
                <LogOutIcon className={ICON.button} aria-hidden />
                Изход
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {billMenuDialogs}
    </>
  )
}
