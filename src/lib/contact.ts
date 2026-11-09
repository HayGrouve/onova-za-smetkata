/**
 * Where Hosts and Guests write to. Who provides the app, and the privacy
 * address, are on the hub's legal pages (`HUB_PRIVACY_URL`, `HUB_TERMS_URL`).
 */
export const SUPPORT_EMAIL = 'support@onovaza.com'

export function mailtoHref(email: string, subject?: string): string {
  return subject
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${email}`
}
