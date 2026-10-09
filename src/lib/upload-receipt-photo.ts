import type { Id } from '../../convex/_generated/dataModel'

const UPLOAD_FAILED = 'Неуспешно качване на снимката.'

/**
 * Post a prepared receipt photo to a Convex upload URL and return its storage
 * id. Every failure is an Error with a message safe to show: what the storage
 * server or the network said stays out of it.
 */
export async function uploadReceiptPhoto(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
): Promise<Id<'_storage'>> {
  let response: Response
  try {
    response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: blob,
    })
  } catch {
    throw new Error(UPLOAD_FAILED)
  }
  if (!response.ok) {
    throw new Error(`Неуспешно качване (${response.status})`)
  }
  let storageId: unknown
  try {
    storageId = Reflect.get(await response.json(), 'storageId')
  } catch {
    throw new Error(UPLOAD_FAILED)
  }
  if (typeof storageId !== 'string' || !storageId) {
    throw new Error(UPLOAD_FAILED)
  }
  return storageId as Id<'_storage'>
}
