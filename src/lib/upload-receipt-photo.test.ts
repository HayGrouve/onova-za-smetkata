import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadReceiptPhoto } from './upload-receipt-photo.ts'

const photo = new Blob(['x'], { type: 'image/jpeg' })

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadReceiptPhoto', () => {
  it('posts the photo with its content type and returns the storage id', async () => {
    const fetchMock = stubFetch(Response.json({ storageId: 'kg2abc' }))

    await expect(
      uploadReceiptPhoto('https://upload.test/x', photo, 'image/jpeg'),
    ).resolves.toBe('kg2abc')
    expect(fetchMock).toHaveBeenCalledWith('https://upload.test/x', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: photo,
    })
  })

  it('never shows what the storage server or the network said', async () => {
    const attempt = () =>
      uploadReceiptPhoto('https://upload.test/x', photo, 'image/jpeg')

    stubFetch(new Response('S3 bucket boom', { status: 500 }))
    const refused = await attempt().catch((error: Error) => error.message)
    expect(refused).not.toContain('boom')
    expect(refused).toContain('500')

    stubFetch(new TypeError('Failed to fetch'))
    const offline = await attempt().catch((error: Error) => error.message)
    expect(offline).not.toContain('fetch')
  })

  it('fails when the answer carries no storage id', async () => {
    stubFetch(Response.json({}))
    await expect(
      uploadReceiptPhoto('https://upload.test/x', photo, 'image/jpeg'),
    ).rejects.toThrow()

    stubFetch(new Response('not json', { status: 200 }))
    await expect(
      uploadReceiptPhoto('https://upload.test/x', photo, 'image/jpeg'),
    ).rejects.toThrow()
  })
})
