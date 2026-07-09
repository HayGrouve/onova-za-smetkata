import { useState } from 'react'
import { WifiOffIcon, XIcon } from 'lucide-react'
import { useOnlineStatus } from '#/hooks/use-online-status.ts'
import { ICON } from '#/lib/app-icons.ts'

export function OfflineBanner() {
  const online = useOnlineStatus()
  const [dismissed, setDismissed] = useState(false)

  if (online || dismissed) return null

  return (
    <div
      role="status"
      className="sticky top-14 z-40 border-b border-accent-foreground/30 bg-accent px-4 py-2 text-sm text-accent-foreground"
    >
      <div className="page-shell flex items-center justify-between gap-3">
        <p className="flex items-center gap-2">
          <WifiOffIcon className={ICON.button} aria-hidden />
          Няма интернет връзка. Данните за сметката изискват мрежа — опитайте
          отново, когато сте онлайн.
        </p>
        <button
          type="button"
          className="tap-feedback rounded-md p-1"
          aria-label="Затвори"
          onClick={() => setDismissed(true)}
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
