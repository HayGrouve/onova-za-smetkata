import { defineConfig } from 'vitest/config'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const isVitest = Boolean(process.env.VITEST)

/** Directives that cannot break a page: clickjacking, <base> and plugin injection. */
const ENFORCED_CSP = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
]

// Clerk's Frontend API (clerk-js and its calls): the custom domain in
// production, *.clerk.accounts.dev for the dev instance.
const CLERK_API =
  'https://clerk.onova-za-smetkata.com https://*.clerk.accounts.dev'
// Clerk's bot protection (Cloudflare Turnstile) loads a script and a frame.
const TURNSTILE = 'https://challenges.cloudflare.com'
const CONVEX_HTTP = 'https://*.convex.cloud'
const CONVEX_WS = 'wss://*.convex.cloud'
const SENTRY_INGEST =
  'https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io'

/**
 * Violations go to Sentry's security endpoint, derived from the DSN at build
 * time (https://<key>@<host>/<project>); nothing is reported without a DSN.
 */
function sentryCspReportUri(): string[] {
  const raw = process.env.VITE_SENTRY_DSN
  if (!raw) return []
  try {
    const dsn = new URL(raw)
    const project = dsn.pathname.replace('/', '')
    return [
      `report-uri https://${dsn.host}/api/${project}/security/?sentry_key=${dsn.username}`,
    ]
  } catch {
    return []
  }
}

/**
 * The full policy, built from what the app loads. Sent as Report-Only until
 * it has been watched on production; then it can replace ENFORCED_CSP.
 *
 * - 'unsafe-inline' scripts: TanStack Start streams inline hydration scripts
 *   and the theme provider sets the class before paint; neither has a nonce.
 * - 'unsafe-eval': heic2any (Android HEIC photos) builds functions with
 *   `new Function` inside its blob: worker.
 * - style 'unsafe-inline': motion and Radix set inline styles.
 * - Vercel Analytics and Speed Insights load /_vercel/... and post to the
 *   same origin, so 'self' covers them. Stripe Checkout and the Customer
 *   Portal are full-page redirects, Revolut opens in a new window.
 */
function reportOnlyCsp(isDev: boolean): string {
  // Dev only: local Convex backend, Vite HMR, Clerk telemetry, Vercel's debug scripts.
  const dev = (sources: string) => (isDev ? ` ${sources}` : '')
  const local =
    'http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*'
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CLERK_API} ${TURNSTILE}${dev('https://va.vercel-scripts.com')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://img.clerk.com ${CONVEX_HTTP}${dev('http://localhost:* http://127.0.0.1:*')}`,
    "font-src 'self' data:",
    `connect-src 'self' ${CLERK_API} ${CONVEX_HTTP} ${CONVEX_WS} ${SENTRY_INGEST}${dev(`${local} https://clerk-telemetry.com https://va.vercel-scripts.com`)}`,
    `frame-src 'self' ${TURNSTILE}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    // frame-ancestors, base-uri and object-src are enforced by ENFORCED_CSP.
    ...sentryCspReportUri(),
  ].join('; ')
}

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'e2e/**',
      '.worktrees/**',
      '.claude/worktrees/**',
    ],
    // Convex function tests (`convex/*.test.ts`) run on convex-test.
    server: { deps: { inline: ['convex-test'] } },
  },
  plugins: [
    ...(command === 'serve' ? [devtools()] : []),
    tailwindcss(),
    tanstackStart(),
    // Nitro's server runtime is for dev/build only; under Vitest it loads CJS
    // React in an ESM runner (`module is not defined`) and keeps the process alive.
    ...(isVitest
      ? []
      : [
          nitro({
            preset: 'vercel',
            routeRules: {
              '/**': {
                headers: {
                  'X-Frame-Options': 'DENY',
                  'X-Content-Type-Options': 'nosniff',
                  'Referrer-Policy': 'strict-origin-when-cross-origin',
                  'Permissions-Policy':
                    'camera=(), microphone=(), geolocation=()',
                  'Strict-Transport-Security':
                    'max-age=63072000; includeSubDomains',
                  'Content-Security-Policy': ENFORCED_CSP.join('; '),
                  'Content-Security-Policy-Report-Only': reportOnlyCsp(
                    command === 'serve',
                  ),
                },
              },
            },
          }),
        ]),
    viteReact(),
  ],
}))
