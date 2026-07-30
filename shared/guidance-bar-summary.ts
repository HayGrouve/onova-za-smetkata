/** First sentence (or full text) for collapsed onboarding hint preview. */
export function guidanceCollapsedPreview(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/^[^.!?]+[.!?]/)
  return match ? match[0].trim() : trimmed
}
