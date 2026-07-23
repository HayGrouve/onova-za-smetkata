import { describe, expect, it, vi } from 'vitest'
import { launchRevolut } from './revolut-launch.ts'

describe('launchRevolut', () => {
  it('opens Revolut before waiting for transfer recording', async () => {
    const events: string[] = []
    let finishRecording: ((recorded: boolean) => void) | undefined
    const recording = new Promise<boolean>((resolve) => {
      finishRecording = resolve
    })

    const result = launchRevolut({
      url: 'https://revolut.me/example?amount=500&currency=EUR',
      openWindow: (url) => {
        events.push(`open:${url}`)
        return {} as Window
      },
      copyAmount: () => events.push('copy'),
      recordTransfer: () => {
        events.push('record')
        return recording
      },
    })

    expect(events).toEqual([
      'open:https://revolut.me/example?amount=500&currency=EUR',
      'copy',
      'record',
    ])

    finishRecording?.(true)
    await expect(result).resolves.toBe('opened')
  })

  it('does not copy or record when the browser blocks the open', async () => {
    const copyAmount = vi.fn()
    const recordTransfer = vi.fn()

    await expect(
      launchRevolut({
        url: 'https://revolut.me/example?amount=500&currency=EUR',
        openWindow: () => null,
        copyAmount,
        recordTransfer,
      }),
    ).resolves.toBe('blocked')
    expect(copyAmount).not.toHaveBeenCalled()
    expect(recordTransfer).not.toHaveBeenCalled()
  })
})
