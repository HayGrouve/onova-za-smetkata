import { copyToClipboard } from '#/lib/copy-to-clipboard.ts'

export type ShareLinkResult = 'shared' | 'copied' | 'cancelled' | 'failed'

export interface ShareLinkOptions {
  url: string
  title?: string
  text?: string
}

export async function shareLink({
  url,
  title,
  text,
}: ShareLinkOptions): Promise<ShareLinkResult> {
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  ) {
    try {
      const payload: ShareData = { url }
      if (title) payload.title = title
      if (text) payload.text = text
      await navigator.share(payload)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  const copied = await copyToClipboard(url)
  return copied ? 'copied' : 'failed'
}
