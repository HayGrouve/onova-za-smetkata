import {
  RECEIPT_IMAGE_MESSAGES,
  receiptImageProblem,
} from '../../shared/receipt-image.ts'

const WEB_SAFE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Non-standard JPEG types some Android pickers still report. */
const JPEG_ALIASES = new Set(['image/jpg', 'image/pjpeg'])

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

export async function prepareReceiptImage(
  file: File,
): Promise<{ blob: Blob; contentType: string }> {
  const prepared = await toReadablePhoto(file)
  // Refuse before uploading what the scanner would refuse anyway.
  const problem = receiptImageProblem({
    size: prepared.blob.size,
    type: prepared.contentType,
  })
  if (problem) throw new Error(problem)
  return prepared
}

async function toReadablePhoto(
  file: File,
): Promise<{ blob: Blob; contentType: string }> {
  if (WEB_SAFE_IMAGE_TYPES.has(file.type)) {
    return { blob: file, contentType: file.type }
  }

  if (JPEG_ALIASES.has(file.type)) {
    return { blob: file, contentType: 'image/jpeg' }
  }

  if (needsHeicConversion(file)) {
    return convertHeicToJpeg(file)
  }

  // Samsung/Android often omits MIME type for HEIC camera captures.
  if (file.type === '' || file.type === 'application/octet-stream') {
    return convertHeicToJpeg(file)
  }

  throw new Error(RECEIPT_IMAGE_MESSAGES.unsupported)
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
