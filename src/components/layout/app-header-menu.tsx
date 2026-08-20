import {
  BookOpenIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CogIcon,
  Link2OffIcon,
  MoreVerticalIcon,
  PencilIcon,
  Share2Icon,
  ShareIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { useFriendGroupsSheet } from '#/components/bills/friend-groups-provider.tsx'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'
import { ThemeRocker } from '#/components/layout/theme-rocker.tsx'

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
  onOpenPaymentSettings,
  onOpenFriendGroups,
  onStartReplay,
}: {
  onOpenPaymentSettings: () => void
  onOpenFriendGroups: () => void
  onStartReplay: () => void
}) {
  return (
    <>
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
    </>
  )
}

function CollapsibleHostSettingsSection({
  open,
  onOpenChange,
  onOpenPaymentSettings,
  onOpenFriendGroups,
  onStartReplay,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
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
          onOpenPaymentSettings={onOpenPaymentSettings}
          onOpenFriendGroups={onOpenFriendGroups}
          onStartReplay={onStartReplay}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AppHeaderMenu({
  showHostActions,
  isHomeRoute = false,
  billMenuItems = [],
  onBillAction,
  billMenuDialogs,
}: AppHeaderMenuProps) {
  const { theme, setTheme } = useTheme()
  const { openPaymentSettings } = usePaymentSettingsSheet()
  const { openFriendGroups } = useFriendGroupsSheet()
  const { startReplay } = useHostOnboarding()
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false)

  const visibleBillItems = billMenuItems.filter((item) => !item.hidden)

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleMenuOpenChange(nextOpen: boolean) {
    setMenuOpen(nextOpen)
    if (!nextOpen) {
      setMoreSettingsOpen(false)
    }
  }

  const hostSettingsHandlers = {
    onOpenPaymentSettings: () => openPaymentSettings(),
    onOpenFriendGroups: () => openFriendGroups(),
    onStartReplay: () => startReplay(),
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
            <ThemeRocker
              theme={theme}
              onThemeChange={(mode) => setTheme(mode)}
            />
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
