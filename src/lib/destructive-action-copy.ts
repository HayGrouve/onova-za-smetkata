export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'default'
}

const DEFAULTS = {
  confirmLabel: 'Потвърди',
  cancelLabel: 'Отказ',
  variant: 'destructive' as const,
}

function withDefaults(options: ConfirmOptions): Required<ConfirmOptions> {
  return {
    description: options.description ?? '',
    confirmLabel: options.confirmLabel ?? DEFAULTS.confirmLabel,
    cancelLabel: options.cancelLabel ?? DEFAULTS.cancelLabel,
    variant: options.variant ?? DEFAULTS.variant,
    title: options.title,
  }
}

export function getBillDeleteCopy(): ConfirmOptions {
  return withDefaults({
    title: 'Изтриване на сметка?',
    description:
      'Това действие е необратимо. Всички участници, артикули и плащания ще бъдат изтрити.',
    confirmLabel: 'Изтрий сметката',
  })
}

export function getItemDeleteCopy(name: string): ConfirmOptions {
  return withDefaults({
    title: 'Изтриване на артикул?',
    description: `„${name}" ще бъде премахнат от сметката.`,
    confirmLabel: 'Изтрий',
  })
}

export function getParticipantRemoveCopy(name: string): ConfirmOptions {
  return withDefaults({
    title: 'Премахване на участник?',
    description: `„${name}" и разпределенията му ще бъдат премахнати.`,
    confirmLabel: 'Премахни',
  })
}

export function getFriendGroupDeleteCopy(name: string): ConfirmOptions {
  return withDefaults({
    title: 'Изтриване на групата?',
    description: `Групата „${name}" ще бъде изтрита завинаги.`,
    confirmLabel: 'Изтрий групата',
  })
}

export function getFriendGroupMemberRemoveCopy(name: string): ConfirmOptions {
  return withDefaults({
    title: 'Премахване от групата?',
    description: `„${name}" ще бъде премахнат от списъка (промяната се записва при „Запази").`,
    confirmLabel: 'Премахни',
  })
}

export function getClaimUnassignCopy(name: string): ConfirmOptions {
  return withDefaults({
    title: 'Премахване на артикул?',
    description: `„${name}" ще бъде премахнат от вашата част.`,
    confirmLabel: 'Премахни',
  })
}

export function getPaymentUndoCopy(): ConfirmOptions {
  return withDefaults({
    title: 'Отмяна на последното плащане?',
    description: 'Последното записано плащане ще бъде отменено.',
    confirmLabel: 'Отмени плащането',
  })
}

export function getSignOutCopy(): ConfirmOptions {
  return withDefaults({
    title: 'Изход от профила?',
    description: 'Ще бъдете изведени от акаунта си.',
    confirmLabel: 'Изход',
  })
}
