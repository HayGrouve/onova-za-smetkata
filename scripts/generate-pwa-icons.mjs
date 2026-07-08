import { accessSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const logoPath = join(root, 'public/logo.png')
const svgPath = join(root, 'public/icon.svg')

function loadSourceImage() {
  try {
    accessSync(logoPath)
    return sharp(logoPath)
  } catch {
    return sharp(readFileSync(svgPath))
  }
}

const source = loadSourceImage()

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  const png = await source.clone().resize(size, size).png().toBuffer()
  writeFileSync(join(root, 'public', name), png)
  console.log(`Wrote public/${name}`)
}
