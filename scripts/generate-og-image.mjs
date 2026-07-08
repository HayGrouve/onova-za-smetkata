import { accessSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const width = 1200
const height = 630
const logoSize = 280
const logoTop = 36
const titleY = 402
const subtitleY = 472

const logoPath = join(root, 'public/logo.png')
const svgPath = join(root, 'public/icon.svg')

const logoInput = (() => {
  try {
    accessSync(logoPath)
    return logoPath
  } catch {
    return sharp(readFileSync(svgPath))
  }
})()

const logoPng =
  typeof logoInput === 'string'
    ? await sharp(logoInput).resize(logoSize, logoSize).png().toBuffer()
    : await logoInput.resize(logoSize, logoSize).png().toBuffer()

const backgroundSvg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a1418"/>
      <stop offset="45%" stop-color="#173a40"/>
      <stop offset="100%" stop-color="#4fb8b2"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <text x="600" y="${titleY}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="64" font-weight="700" fill="#f3faf5">Онова за сметката</text>
  <text x="600" y="${subtitleY}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="30" font-weight="500" fill="#d7ece8">Раздели ресторантската сметка лесно</text>
</svg>
`

const background = await sharp(Buffer.from(backgroundSvg)).png().toBuffer()

const output = await sharp(background)
  .composite([
    {
      input: logoPng,
      top: logoTop,
      left: Math.round((width - logoSize) / 2),
    },
  ])
  .png()
  .toBuffer()

writeFileSync(join(root, 'public/og-image.png'), output)
console.log('Wrote public/og-image.png')
