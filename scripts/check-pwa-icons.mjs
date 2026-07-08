import { accessSync } from 'node:fs'

const required = [
  'public/logo.png',
  'public/icon-192.png',
  'public/icon-512.png',
  'public/apple-touch-icon.png',
  'public/og-image.png',
]

for (const file of required) {
  accessSync(file)
}

console.log('PWA icons OK')
