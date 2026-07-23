import { spawnSync } from 'node:child_process'

/** Matches GitHub Actions `preflight` job — override via env when needed. */
const DEFAULT_VITE_CONVEX_URL = 'https://coordinated-warbler-782.convex.cloud'

if (!process.env.VITE_CONVEX_URL) {
  process.env.VITE_CONVEX_URL = DEFAULT_VITE_CONVEX_URL
}

const steps = ['check', 'lint', 'preflight']

for (const step of steps) {
  const result = spawnSync('pnpm', ['run', step], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
