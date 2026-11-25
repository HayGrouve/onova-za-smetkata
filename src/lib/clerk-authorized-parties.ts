/**
 * The origins whose Clerk session tokens SSR accepts (the token's `azp`),
 * from the comma separated server env `CLERK_AUTHORIZED_PARTIES`. Set only in
 * Production (`https://smetkata.onovaza.com`): every app on the shared Акаунт
 * gets tokens from the same Clerk instance, so this keeps another
 * subdomain's token out. Unset (local, previews) means no `azp` check.
 */
export function parseAuthorizedParties(
  raw: string | undefined,
): string[] | undefined {
  const parties = (raw ?? '')
    .split(',')
    .map((party) => party.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return parties.length > 0 ? parties : undefined
}
