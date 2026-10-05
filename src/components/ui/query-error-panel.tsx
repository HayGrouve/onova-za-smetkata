import { RefreshCwIcon } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'

export interface QueryErrorPanelProps {
  message?: string
  /** Omit when retrying cannot help (the server gave a definite reason). */
  onRetry?: () => void
}

export function QueryErrorPanel({
  message = 'Неуспешно зареждане. Проверете интернет връзката.',
  onRetry,
}: QueryErrorPanelProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
      <p className="text-sm text-muted-foreground" role="alert">
        {message}
      </p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={onRetry}
        >
          <RefreshCwIcon className={ICON.button} aria-hidden />
          Опитай отново
        </Button>
      ) : null}
    </div>
  )
}
