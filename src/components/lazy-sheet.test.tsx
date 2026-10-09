// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MountOnFirstOpen, lazySheet } from './lazy-sheet.tsx'

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (message: string) => toastError(message) },
}))

afterEach(() => {
  cleanup()
  toastError.mockReset()
})

function FakeSheet({ open }: { open: boolean }) {
  return open ? <div role="dialog">Листче</div> : null
}

/** A provider-like harness: `open` lives above the lazy sheet. */
function renderHarness(load: () => Promise<typeof FakeSheet>) {
  const sheet = lazySheet(load)
  let setOpen: (open: boolean) => void = () => {}
  function Harness() {
    const [open, setOpenState] = useState(false)
    setOpen = setOpenState
    return (
      <>
        <p>Страница</p>
        <MountOnFirstOpen open={open} onClose={() => setOpenState(false)}>
          <sheet.Sheet open={open} />
        </MountOnFirstOpen>
      </>
    )
  }
  render(<Harness />)
  return {
    // Async act: the sheet suspends while its chunk loads.
    open: (value: boolean) =>
      act(async () => {
        setOpen(value)
      }),
    sheet,
  }
}

describe('MountOnFirstOpen with a lazySheet', () => {
  it('loads nothing until the sheet is first opened', async () => {
    const load = vi.fn(() => Promise.resolve(FakeSheet))
    const harness = renderHarness(load)
    expect(load).not.toHaveBeenCalled()

    await harness.open(true)
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps the page and offers a retry when the chunk fails to load', async () => {
    const load = vi
      .fn<() => Promise<typeof FakeSheet>>()
      .mockRejectedValueOnce(
        new Error('Failed to fetch dynamically imported module'),
      )
      .mockResolvedValue(FakeSheet)
    const harness = renderHarness(load)

    await harness.open(true)
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
    expect(toastError.mock.calls[0][0]).toMatch(/Обновете страницата/)
    // One fetch per open: React's re-renders do not keep refetching.
    expect(load).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Страница')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()

    // The failed open was closed, so the next tap loads again.
    await harness.open(true)
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('preload failures are retried by the next open', async () => {
    const load = vi
      .fn<() => Promise<typeof FakeSheet>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(FakeSheet)
    const harness = renderHarness(load)

    await expect(harness.sheet.preload()).rejects.toThrow('offline')
    await harness.open(true)
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(toastError).not.toHaveBeenCalled()
  })
})
