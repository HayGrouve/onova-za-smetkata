/** Prod deployment slugs — never enable Password auth here, even if DEV_MODE is mis-set. */
const PROD_DEPLOYMENT_SLUGS = ['coordinated-warbler-782'] as const

/** Known dev deployments where Password auth is allowed when DEV_MODE=true. */
const DEV_DEPLOYMENT_SLUGS = ['striped-shepherd-984'] as const

function normalizeDeploymentName(deployment: string): string {
  return deployment.replace(/^dev:/, '').trim()
}

function getDevAllowlist(): string[] {
  const fromEnv =
    process.env.CONVEX_DEV_DEPLOYMENTS?.split(',')
      .map((slug) => slug.trim())
      .filter(Boolean) ?? []
  return [...DEV_DEPLOYMENT_SLUGS, ...fromEnv]
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

  return getDevAllowlist().includes(deployment)
}

/** @deprecated use isDevModeEnabled */
export function isDevMode(): boolean {
  return isDevModeEnabled()
}

export const DEV_USER_EMAIL = 'dev@local.test'
export const DEV_USER_NAME = 'Dev User'
export const DEV_USER_PASSWORD = 'devpassword'
