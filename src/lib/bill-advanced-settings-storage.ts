export const BILL_ADVANCED_SETTINGS_OPEN_KEY = 'bill-advanced-settings-open'

export function readBillAdvancedSettingsOpen(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(BILL_ADVANCED_SETTINGS_OPEN_KEY) === '1'
}

export function writeBillAdvancedSettingsOpen(open: boolean): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(BILL_ADVANCED_SETTINGS_OPEN_KEY, open ? '1' : '0')
}
