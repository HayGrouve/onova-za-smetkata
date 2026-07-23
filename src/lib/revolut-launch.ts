export type LaunchRevolutResult = 'blocked' | 'opened' | 'recording-failed'

export interface LaunchRevolutOptions {
  url: string
  openWindow: (url: string) => Window | null
  copyAmount: () => void
  recordTransfer: () => Promise<boolean>
}

export async function launchRevolut({
  url,
  openWindow,
  copyAmount,
  recordTransfer,
}: LaunchRevolutOptions): Promise<LaunchRevolutResult> {
  const openedWindow = openWindow(url)
  if (!openedWindow) return 'blocked'

  copyAmount()
  const recorded = await recordTransfer()
  return recorded ? 'opened' : 'recording-failed'
}
