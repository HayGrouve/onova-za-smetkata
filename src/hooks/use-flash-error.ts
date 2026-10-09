import { useCallback, useEffect, useRef, useState } from 'react'

const FLASH_ERROR_MS = 2800

/**
 * A short error pinned to one receipt line (`key`): shown for a moment, then
 * cleared. A newer flash replaces the older one and restarts the clock.
 */
export function useFlashError() {
  const [lineError, setLineError] = useState<{
    key: string
    text: string
  } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const flashError = useCallback((key: string, text: string) => {
    setLineError({ key, text })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setLineError(null), FLASH_ERROR_MS)
  }, [])

  return { lineError, flashError }
}
