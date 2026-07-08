import { defineConfig } from 'vitest/config'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  plugins: [
    ...(command === 'serve' ? [devtools()] : []),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: 'vercel' }),
    viteReact(),
  ],
}))
