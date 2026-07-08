/** Prod deployment slugs — never enable Password auth here, even if DEV_MODE is mis-set. */
const PROD_DEPLOYMENT_SLUGS = ['coordinated-warbler-782'] as const

function normalizeDeploymentName(deployment: string): string {
  return deployment.replace(/^dev:/, '').trim()
}

export function isDevModeEnabled(): boolean {
  if (process.env.DEV_MODE !== 'true') return false

  const deployment = normalizeDeploymentName(process.env.CONVEX_DEPLOYMENT ?? '')
  if (
    PROD_DEPLOYMENT_SLUGS.includes(
      deployment as (typeof PROD_DEPLOYMENT_SLUGS)[number],
    )
  ) {
    return false
  }

  const prodOverride = process.env.CONVEX_PROD_DEPLOYMENT?.trim()
  if (prodOverride && deployment === prodOverride) {
    return false
  }

  return true
}

/** @deprecated use isDevModeEnabled */
export function isDevMode(): boolean {
  return isDevModeEnabled()
}

export const DEV_USER_EMAIL = 'dev@local.test'
export const DEV_USER_NAME = 'Dev User'
export const DEV_USER_PASSWORD = 'devpassword'
