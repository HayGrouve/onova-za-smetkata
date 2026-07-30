import { useAuthActions } from '@convex-dev/auth/react'
import {
  BookOpenIcon,
  CheckCircleIcon,
  ChevronDownIcon,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible.tsx'
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
import { cn } from '#/lib/utils.ts'

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
  /** When false, global host items nest under „Още настройки“. */
  isHomeRoute?: boolean
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

function HostSettingsMenuItems({
  onSignOut,
  onOpenProfile,
  onOpenPaymentSettings,
  onOpenFriendGroups,
  onStartReplay,
}: {
  onSignOut: () => void
  onOpenProfile: () => void
  onOpenPaymentSettings: () => void
  onOpenFriendGroups: () => void
  onStartReplay: () => void
}) {
  return (
    <>
      <DropdownMenuItem onSelect={onOpenProfile}>
        <UserIcon className={ICON.button} aria-hidden />
        Профил
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onOpenPaymentSettings}>
        <CogIcon className={ICON.button} aria-hidden />
        Настройки за плащане
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onOpenFriendGroups}>
        <UsersIcon className={ICON.button} aria-hidden />
        Моите групи
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onStartReplay}>
        <BookOpenIcon className={ICON.button} aria-hidden />
        {HOST_ONBOARDING_HOME.helpAndGuidance}
      </DropdownMenuItem>
      <DropdownMenuItem
        variant="destructive"
        onSelect={(event) => {
          event.preventDefault()
          onSignOut()
        }}
      >
        <LogOutIcon className={ICON.button} aria-hidden />
        Изход
      </DropdownMenuItem>
    </>
  )
}

function CollapsibleHostSettingsSection({
  open,
  onOpenChange,
  onSignOut,
  onOpenProfile,
  onOpenPaymentSettings,
  onOpenFriendGroups,
  onStartReplay,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSignOut: () => void
  onOpenProfile: () => void
  onOpenPaymentSettings: () => void
  onOpenFriendGroups: () => void
  onStartReplay: () => void
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <DropdownMenuItem
          aria-expanded={open}
          onSelect={(event) => {
            event.preventDefault()
          }}
        >
          <CogIcon className={ICON.button} aria-hidden />
          Още настройки
          <ChevronDownIcon
            className={cn(
              ICON.button,
              'ml-auto shrink-0 transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </DropdownMenuItem>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
        <HostSettingsMenuItems
          onOpenProfile={onOpenProfile}
          onOpenPaymentSettings={onOpenPaymentSettings}
          onOpenFriendGroups={onOpenFriendGroups}
          onStartReplay={onStartReplay}
          onSignOut={onSignOut}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AppHeaderMenu({
  showHostActions,
  isHomeRoute = false,
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false)

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

  function handleMenuOpenChange(nextOpen: boolean) {
    setMenuOpen(nextOpen)
    if (!nextOpen) {
      setMoreSettingsOpen(false)
    }
  }

  const hostSettingsHandlers = {
    onOpenProfile: () => openProfile(),
    onOpenPaymentSettings: () => openPaymentSettings(),
    onOpenFriendGroups: () => openFriendGroups(),
    onStartReplay: () => startReplay(),
    onSignOut: () => void handleSignOutWithConfirm(),
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
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
              {isHomeRoute ? (
                <HostSettingsMenuItems {...hostSettingsHandlers} />
              ) : (
                <CollapsibleHostSettingsSection
                  open={moreSettingsOpen}
                  onOpenChange={setMoreSettingsOpen}
                  {...hostSettingsHandlers}
                />
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {billMenuDialogs}
    </>
  )
}
