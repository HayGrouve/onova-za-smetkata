import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shareLink } from './share-link.ts'

describe('shareLink', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })

    await expect(
      shareLink({
        url: 'https://example.com/join',
        title: 'Сметка',
        text: 'Присъедини се',
      }),
    ).resolves.toBe('shared')

    expect(share).toHaveBeenCalledWith({
      url: 'https://example.com/join',
      title: 'Сметка',
      text: 'Присъедини се',
    })
  })

  it('returns cancelled when the user dismisses the share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'))
    vi.stubGlobal('navigator', { share })

    await expect(shareLink({ url: 'https://example.com/join' })).resolves.toBe(
      'cancelled',
    )
  })

  it('falls back to clipboard when share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(shareLink({ url: 'https://example.com/join' })).resolves.toBe(
      'copied',
    )
    expect(writeText).toHaveBeenCalledWith('https://example.com/join')
  })
})
