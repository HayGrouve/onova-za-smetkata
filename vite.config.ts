import { defineConfig } from 'vitest/config'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const isVitest = Boolean(process.env.VITEST)

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
                },
              },
            },
          }),
        ]),
    viteReact(),
  ],
}))
