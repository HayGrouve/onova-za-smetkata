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

// The header shows the logo at 32 CSS px; 96 px covers 3x screens.
await source
  .clone()
  .resize(96, 96)
  .webp({ quality: 85 })
  .toFile(join(root, 'public/logo-96.webp'))
console.log('Wrote public/logo-96.webp')

// favicon.ico: 16, 32 and 48 px PNG entries (every current browser reads PNG
// inside ICO).
const faviconSizes = [16, 32, 48]
const pngs = await Promise.all(
  faviconSizes.map((size) =>
    source
      .clone()
      .resize(size, size)
      .png({ compressionLevel: 9, palette: true })
      .toBuffer(),
  ),
)
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(pngs.length, 4)
const entries = []
let offset = 6 + 16 * pngs.length
pngs.forEach((png, index) => {
  const size = faviconSizes[index]
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size, 0)
  entry.writeUInt8(size, 1)
  entry.writeUInt8(0, 2)
  entry.writeUInt8(0, 3)
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(offset, 12)
  offset += png.length
  entries.push(entry)
})
writeFileSync(
  join(root, 'public/favicon.ico'),
  Buffer.concat([header, ...entries, ...pngs]),
)
console.log('Wrote public/favicon.ico')
