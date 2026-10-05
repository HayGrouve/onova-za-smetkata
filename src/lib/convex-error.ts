/**
 * The message a Convex function threw on purpose (`ConvexError`), or null for
 * anything else (network, validator, crash) — those keep a generic message.
 */
export function getConvexErrorData(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = Reflect.get(error, 'data')
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    const message = Reflect.get(data, 'message')
    if (typeof message === 'string' && message.trim()) return message
  }
  return null
}

export function getConvexErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = Reflect.get(error, 'data')
    if (typeof data === 'string' && data.trim()) return data
    if (data && typeof data === 'object') {
      const message = Reflect.get(data, 'message')
      if (typeof message === 'string' && message.trim()) return message
    }
  }

  if (error instanceof Error && error.message) {
    return extractConvexUserMessage(error.message)
  }

  return 'Неуспешна операция'
}

/** Strip Convex client wrapper noise; keep the server-thrown message. */
function extractConvexUserMessage(message: string): string {
  const uncaught = message.match(/Uncaught ConvexError: ([^\n]+)/)
  if (uncaught?.[1]) return uncaught[1].trim()

  const convexError = message.match(/ConvexError: ([^\n]+)/)
  if (convexError?.[1]) return convexError[1].trim()

  if (!message.startsWith('[CONVEX')) return message

  return 'Неуспешна операция'
}
