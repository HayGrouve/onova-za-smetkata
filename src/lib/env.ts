export function getConvexUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim()
  return trimmed || undefined
}

export function validateConvexUrlForBuild(options: {
  prod: boolean
  convexUrl: string | undefined
}): void {
  if (options.prod && !options.convexUrl) {
    throw new Error(
      'Missing VITE_CONVEX_URL. Set it in Vercel environment variables before building for production.',
    )
  }
}

export function assertConvexUrlForBuild(): string | undefined {
  const convexUrl = getConvexUrl(import.meta.env.VITE_CONVEX_URL)
  validateConvexUrlForBuild({
    prod: import.meta.env.PROD,
    convexUrl,
  })
  return convexUrl
}
