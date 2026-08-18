export type AppHeaderRouteContext =
  | 'home'
  | 'login'
  | 'hostAccount'
  | 'editor'
  | 'summary'
  | 'hostClaim'
  | 'guestJoin'
  | 'guestClaim'

export type AppHeaderMenuBillActionId =
  | 'shareJoinLink'
  | 'rotateShareToken'
  | 'finalizeBill'
  | 'deleteBill'
  | 'editBill'
  | 'shareBillText'
  | 'goToEditor'

export interface AppHeaderMenuItemDescriptor {
  id: AppHeaderMenuBillActionId
  label: string
  variant?: 'default' | 'destructive'
  disabled?: boolean
  hidden?: boolean
  tooltip?: string
}

export interface AppHeaderMenuConfigInput {
  routeContext: AppHeaderRouteContext
  billStatus?: 'draft' | 'final'
  participantCount: number
  /** True when validateBillForFinalize passes excluding unpaid guest checks. */
  finalizeValidationPasses: boolean
  unpaidCount: number
}

const FINALIZE_UNPAID_TOOLTIP =
  'Всички гости трябва да платят, преди да завършите сметката.'

export { FINALIZE_UNPAID_TOOLTIP }

function finalizeItem(
  input: AppHeaderMenuConfigInput,
): AppHeaderMenuItemDescriptor {
  const isDraft = input.billStatus === 'draft'
  const hidden = !isDraft
  const disabled =
    !input.finalizeValidationPasses ||
    input.unpaidCount > 0 ||
    input.billStatus !== 'draft'
  const tooltip =
    input.finalizeValidationPasses && input.unpaidCount > 0
      ? FINALIZE_UNPAID_TOOLTIP
      : undefined

  return {
    id: 'finalizeBill',
    label: 'Завърши сметка',
    hidden,
    disabled: hidden ? undefined : disabled,
    tooltip: hidden ? undefined : tooltip,
  }
}

function shareJoinLinkItem(
  input: AppHeaderMenuConfigInput,
): AppHeaderMenuItemDescriptor {
  const hidden = input.billStatus === 'final'
  return {
    id: 'shareJoinLink',
    label: 'Сподели линк',
    hidden,
    disabled: hidden ? undefined : input.participantCount < 1,
  }
}

function rotateShareTokenItem(
  input: AppHeaderMenuConfigInput,
): AppHeaderMenuItemDescriptor {
  const hidden = input.billStatus !== 'draft'
  return {
    id: 'rotateShareToken',
    label: 'Обнови линка',
    hidden,
  }
}

function deleteBillItem(): AppHeaderMenuItemDescriptor {
  return {
    id: 'deleteBill',
    label: 'Изтрий',
    variant: 'destructive',
  }
}

function editBillItem(): AppHeaderMenuItemDescriptor {
  return {
    id: 'editBill',
    label: 'Редактирай',
  }
}

function shareBillTextItem(): AppHeaderMenuItemDescriptor {
  return {
    id: 'shareBillText',
    label: 'Сподели сметка',
  }
}

function goToEditorItem(
  input: AppHeaderMenuConfigInput,
): AppHeaderMenuItemDescriptor {
  const hidden = input.billStatus !== 'draft'
  return {
    id: 'goToEditor',
    label: 'Към редактора',
    hidden,
  }
}

export function buildAppHeaderMenuConfig(
  input: AppHeaderMenuConfigInput,
): AppHeaderMenuItemDescriptor[] {
  switch (input.routeContext) {
    case 'home':
    case 'login':
    case 'hostAccount':
    case 'guestJoin':
    case 'guestClaim':
      return []
    case 'editor':
      if (input.billStatus === 'final') {
        return [shareBillTextItem(), deleteBillItem()]
      }
      return [
        shareJoinLinkItem(input),
        rotateShareTokenItem(input),
        finalizeItem(input),
        deleteBillItem(),
      ]
    case 'summary':
      if (input.billStatus === 'final') {
        return [shareBillTextItem(), deleteBillItem()]
      }
      return [
        finalizeItem(input),
        editBillItem(),
        shareBillTextItem(),
        deleteBillItem(),
      ]
    case 'hostClaim':
      if (input.billStatus === 'final') {
        return [shareBillTextItem(), deleteBillItem()]
      }
      return [
        shareJoinLinkItem(input),
        rotateShareTokenItem(input),
        goToEditorItem(input),
        deleteBillItem(),
      ]
  }
}

export function shouldShowBillMenuGroup(
  routeContext: AppHeaderRouteContext,
): boolean {
  return (
    routeContext === 'editor' ||
    routeContext === 'summary' ||
    routeContext === 'hostClaim'
  )
}
