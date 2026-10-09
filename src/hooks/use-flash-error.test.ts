// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFlashError } from './use-flash-error.ts'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useFlashError', () => {
  it('shows the error on its line, then clears it', () => {
    const { result } = renderHook(() => useFlashError())

    act(() => result.current.flashError('beer', 'Взето е.'))
    expect(result.current.lineError).toEqual({ key: 'beer', text: 'Взето е.' })

    act(() => {
      vi.advanceTimersByTime(2799)
    })
    expect(result.current.lineError).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.lineError).toBeNull()
  })

  it('a newer error replaces the older one and restarts the clock', () => {
    const { result } = renderHook(() => useFlashError())

    act(() => result.current.flashError('beer', 'Едно.'))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    act(() => result.current.flashError('soup', 'Две.'))
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.lineError).toEqual({ key: 'soup', text: 'Две.' })
  })

  it('leaves no timer running after unmount', () => {
    const { result, unmount } = renderHook(() => useFlashError())

    act(() => result.current.flashError('beer', 'Взето е.'))
    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
