export function getClerkPublishableKey(
  raw: string | undefined = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
    string | undefined,
): string | undefined {
  const trimmed = raw?.trim()
  return trimmed || undefined
}
