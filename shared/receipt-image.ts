/**
 * Receipt photos go to Gemini as inline data, which caps the whole request at
 * 20 MB; base64 adds a third, so 12 MB leaves room for the prompt.
 */
export const RECEIPT_IMAGE_MAX_BYTES = 12 * 1024 * 1024

/** Photo types Gemini reads (HEIC is converted to JPEG before upload). */
const RECEIPT_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export const RECEIPT_IMAGE_MESSAGES = {
  unsupported: 'Поддържат се само изображения (JPEG, PNG, HEIC).',
  tooLarge: 'Снимката е по-голяма от 12 MB. Изберете по-малка снимка.',
  scanFailed:
    'Неуспешно разпознаване на бележката. Опитайте отново или с по-ясна снимка.',
} as const

/** Why a receipt photo cannot be read, or null when it can. */
export function receiptImageProblem(image: {
  size: number
  type: string
}): string | null {
  if (!RECEIPT_IMAGE_TYPES.has(image.type)) {
    return RECEIPT_IMAGE_MESSAGES.unsupported
  }
  if (image.size > RECEIPT_IMAGE_MAX_BYTES) {
    return RECEIPT_IMAGE_MESSAGES.tooLarge
  }
  return null
}
