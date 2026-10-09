import { Link } from '@tanstack/react-router'
import { RefreshCwIcon } from 'lucide-react'
import { Receipt } from '#/components/receipt/paper.tsx'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'

export interface QueryErrorPanelProps {
  message?: string
  /** A heading for the note, e.g. when it is the whole page. */
  title?: string
  /** Omit when retrying cannot help (the server gave a definite reason). */
  onRetry?: () => void
  /** A way out for errors that retrying cannot fix. */
  homeLink?: boolean
}

/** A short printed note on paper: the data did not load. */
export function QueryErrorPanel({
  message = 'Неуспешно зареждане. Проверете интернет връзката.',
  title,
  onRetry,
  homeLink = false,
}: QueryErrorPanelProps) {
  return (
    <Receipt>
      <div className="flex flex-col items-center gap-3 text-center">
        {title ? (
          <h2 className="font-display text-[20px] font-bold">{title}</h2>
        ) : null}
        <p className="text-[13px] leading-6" role="alert">
          {message}
        </p>
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            <RefreshCwIcon className={ICON.button} aria-hidden />
            Опитай отново
          </Button>
        ) : null}
        {homeLink ? (
          <Button asChild className="w-full">
            <Link to="/">Към началото</Link>
          </Button>
        ) : null}
      </div>
    </Receipt>
  )
}
