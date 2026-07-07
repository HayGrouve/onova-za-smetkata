import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from './copy-to-clipboard.ts'

describe('copyToClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('uses clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyToClipboard('https://example.com/join')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://example.com/join')
  })

  it('falls back to execCommand when clipboard API fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const execCommand = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('document', {
      createElement: () => {
        const el = {
          value: '',
          style: {} as CSSStyleDeclaration,
          focus: vi.fn(),
          select: vi.fn(),
          setAttribute: vi.fn(),
        }
        return el
      },
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand,
    })

    await expect(copyToClipboard('hello')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})
