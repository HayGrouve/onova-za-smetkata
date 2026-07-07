const WEB_SAFE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const HEIC_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])

function hasHeicExtension(fileName: string): boolean {
  return /\.(heic|heif)$/i.test(fileName)
}

export function needsHeicConversion(file: File): boolean {
  if (HEIC_TYPES.has(file.type)) return true
  if (hasHeicExtension(file.name)) return true
  // Samsung/Android often reports an empty MIME type for HEIC captures.
  if (file.type === '' && hasHeicExtension(file.name)) return true
  return false
}

export function resolveUploadContentType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type
  }
  if (hasHeicExtension(file.name)) return 'image/heic'
  return 'image/jpeg'
}

export async function prepareReceiptImage(
  file: File,
): Promise<{ blob: Blob; contentType: string }> {
  if (WEB_SAFE_IMAGE_TYPES.has(file.type)) {
    return { blob: file, contentType: file.type }
  }

  if (needsHeicConversion(file)) {
    return convertHeicToJpeg(file)
  }

  if (file.type.startsWith('image/')) {
    return { blob: file, contentType: file.type }
  }

  // Samsung/Android often omits MIME type for HEIC camera captures.
  if (file.type === '' || file.type === 'application/octet-stream') {
    return convertHeicToJpeg(file)
  }

  throw new Error('Поддържат се само изображения (JPEG, PNG, HEIC).')
}

async function convertHeicToJpeg(
  file: File,
): Promise<{ blob: Blob; contentType: string }> {
  try {
    const heic2any = (await import('heic2any')).default
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    })
    const first = Array.isArray(converted) ? converted[0] : converted
    return { blob: first, contentType: 'image/jpeg' }
  } catch {
    throw new Error(
      'Неуспешно конвертиране на HEIC. Опитайте да направите JPEG снимка от камерата или галерията.',
    )
  }
}
