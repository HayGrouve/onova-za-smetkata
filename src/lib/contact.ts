/**
 * Who provides the app and how to reach them (ЗЕТ чл. 4, GDPR чл. 13).
 * Add the address and registration once the freelancer registration is done.
 */
export const PROVIDER_NAME = 'Цветомир Цеков'

export const SUPPORT_EMAIL = 'support@onova-za-smetkata.com'

export const PRIVACY_EMAIL = 'privacy@onova-za-smetkata.com'

export function mailtoHref(email: string, subject?: string): string {
  return subject
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${email}`
}
