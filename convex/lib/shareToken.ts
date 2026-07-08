export function createShareToken(): string {
  return crypto.randomUUID()
}
