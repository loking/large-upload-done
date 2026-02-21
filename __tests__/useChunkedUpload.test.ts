import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChunkedUpload } from '@/hooks/useChunkedUpload'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeFile(sizeBytes: number): File {
  return new File([new ArrayBuffer(sizeBytes)], 'test.csv', { type: 'text/csv' })
}

describe('useChunkedUpload hook', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('initial state is idle', () => {
    const { result } = renderHook(() => useChunkedUpload())
    expect(result.current.state.phase).toBe('idle')
  })

  it('start triggers upload flow to done', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 'sess-1' }) })
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const { result } = renderHook(() => useChunkedUpload())

    await act(async () => {
      await result.current.start(makeFile(1024))
    })

    expect(result.current.state.phase).toBe('done')
  })

  it('exposes sessionId from done state', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 'sess-abc' }) })
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const { result } = renderHook(() => useChunkedUpload())

    await act(async () => {
      await result.current.start(makeFile(1024))
    })

    expect(result.current.sessionId).toBe('sess-abc')
  })

  it('reset returns to idle', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 's' }) })
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const { result } = renderHook(() => useChunkedUpload())

    await act(async () => {
      await result.current.start(makeFile(1024))
    })
    expect(result.current.state.phase).toBe('done')

    act(() => {
      result.current.reset()
    })
    expect(result.current.state.phase).toBe('idle')
  })

  it('completes with correct chunk size option', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 's' }) })
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })

    const { result } = renderHook(() => useChunkedUpload({ chunkSize: 512 }))

    await act(async () => {
      await result.current.start(makeFile(1024))
    })

    expect(result.current.state.phase).toBe('done')
  })
})
