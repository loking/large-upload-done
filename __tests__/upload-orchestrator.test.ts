import { describe, it, expect, vi } from 'vitest'
import { createOrchestrator } from '@/lib/upload-orchestrator'
import type { UploadState } from '@/lib/upload-state'

function makeFile(sizeBytes: number): File {
  const buffer = new ArrayBuffer(sizeBytes)
  return new File([buffer], 'test.csv', { type: 'text/csv' })
}

function trackStates(config?: { chunkSize?: number }) {
  const states: UploadState[] = []
  const mockInit = vi.fn().mockResolvedValue({ sessionId: 'sess-1' })
  const mockSend = vi.fn().mockResolvedValue(undefined)
  const mockFinalize = vi.fn().mockResolvedValue(undefined)

  const orchestrator = createOrchestrator(mockInit, mockSend, mockFinalize, {
    chunkSize: config?.chunkSize ?? 1024,
    maxRetries: 3,
    retryDelayMs: 0,
    onStateChange: (s) => states.push(structuredClone(s)),
  })

  return { states, mockInit, mockSend, mockFinalize, orchestrator }
}

describe('upload orchestrator', () => {
  it('happy path: init -> chunks -> finalize -> done', async () => {
    const { states, orchestrator } = trackStates({ chunkSize: 1024 })
    const file = makeFile(2048) // 2 chunks

    await orchestrator.start(file)

    const phases = states.map((s) => s.phase)
    expect(phases).toEqual([
      'validating',
      'uploading',   // after init
      'uploading',   // after chunk 0
      'finalizing',  // after chunk 1 (last)
      'done',
    ])
  })

  it('calls init with file info', async () => {
    const { mockInit, orchestrator } = trackStates()
    const file = makeFile(1024)

    await orchestrator.start(file)

    expect(mockInit).toHaveBeenCalledOnce()
    const [fileInfo, signal] = mockInit.mock.calls[0]
    expect(fileInfo.name).toBe('test.csv')
    expect(fileInfo.size).toBe(1024)
    expect(signal).toBeInstanceOf(AbortSignal)
  })

  it('sends correct chunk data', async () => {
    const { mockSend, orchestrator } = trackStates({ chunkSize: 1024 })
    const file = makeFile(2048)

    await orchestrator.start(file)

    expect(mockSend).toHaveBeenCalledTimes(2)
    const [sid, idx] = mockSend.mock.calls[0]
    expect(sid).toBe('sess-1')
    expect(idx).toBe(0)
  })

  it('chunk failure triggers error state', async () => {
    const states: UploadState[] = []
    const o = createOrchestrator(
      vi.fn().mockResolvedValue({ sessionId: 's' }),
      vi.fn().mockRejectedValue(new Error('network error')),
      vi.fn(),
      { chunkSize: 1024, maxRetries: 1, retryDelayMs: 0, onStateChange: (s) => states.push(s) },
    )

    await o.start(makeFile(1024))

    const last = states[states.length - 1]
    expect(last.phase).toBe('error')
    if (last.phase === 'error') {
      expect(last.retryable).toBe(true)
    }
  })

  it('retries failed chunks up to maxRetries', async () => {
    let callCount = 0
    const flakyMockSend = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount <= 2) throw new Error('flaky')
    })

    const states: UploadState[] = []
    const o = createOrchestrator(
      vi.fn().mockResolvedValue({ sessionId: 's' }),
      flakyMockSend,
      vi.fn().mockResolvedValue(undefined),
      { chunkSize: 1024, maxRetries: 3, retryDelayMs: 0, onStateChange: (s) => states.push(s) },
    )

    await o.start(makeFile(1024))

    const last = states[states.length - 1]
    expect(last.phase).toBe('done')
    expect(flakyMockSend).toHaveBeenCalledTimes(3)
  })

  it('cancel aborts in-flight request', async () => {
    const sendPromise = new Promise<void>(() => {}) // never resolves
    const mockSend = vi.fn().mockReturnValue(sendPromise)

    const states: UploadState[] = []
    const o = createOrchestrator(
      vi.fn().mockResolvedValue({ sessionId: 's' }),
      mockSend,
      vi.fn(),
      { chunkSize: 1024, maxRetries: 1, retryDelayMs: 0, onStateChange: (s) => states.push(s) },
    )

    const promise = o.start(makeFile(1024))
    o.cancel()
    await promise

    const last = states[states.length - 1]
    expect(last.phase).toBe('idle')
  })

  it('finalize failure -> error with retryable', async () => {
    const states: UploadState[] = []
    const o = createOrchestrator(
      vi.fn().mockResolvedValue({ sessionId: 's' }),
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockRejectedValue(new Error('finalize boom')),
      { chunkSize: 1024, maxRetries: 1, retryDelayMs: 0, onStateChange: (s) => states.push(s) },
    )

    await o.start(makeFile(1024))

    const last = states[states.length - 1]
    expect(last.phase).toBe('error')
    if (last.phase === 'error') {
      expect(last.retryable).toBe(true)
      expect(last.message).toContain('finalize')
    }
  })

  it('init failure -> error', async () => {
    const states: UploadState[] = []
    const o = createOrchestrator(
      vi.fn().mockRejectedValue(new Error('init failed')),
      vi.fn(),
      vi.fn(),
      { chunkSize: 1024, maxRetries: 1, retryDelayMs: 0, onStateChange: (s) => states.push(s) },
    )

    await o.start(makeFile(1024))

    const last = states[states.length - 1]
    expect(last.phase).toBe('error')
    if (last.phase === 'error') {
      expect(last.retryable).toBe(true)
    }
  })

  it('validates non-CSV file', async () => {
    const states: UploadState[] = []
    const o = createOrchestrator(
      vi.fn(),
      vi.fn(),
      vi.fn(),
      { chunkSize: 1024, maxRetries: 1, retryDelayMs: 0, onStateChange: (s) => states.push(s) },
    )

    const badFile = new File([new ArrayBuffer(100)], 'test.txt', { type: 'text/plain' })
    await o.start(badFile)

    const last = states[states.length - 1]
    expect(last.phase).toBe('error')
    if (last.phase === 'error') {
      expect(last.retryable).toBe(false)
    }
  })

  it('validates empty file', async () => {
    const states: UploadState[] = []
    const o = createOrchestrator(
      vi.fn(),
      vi.fn(),
      vi.fn(),
      { chunkSize: 1024, maxRetries: 1, retryDelayMs: 0, onStateChange: (s) => states.push(s) },
    )

    const emptyFile = new File([], 'test.csv', { type: 'text/csv' })
    await o.start(emptyFile)

    const last = states[states.length - 1]
    expect(last.phase).toBe('error')
    if (last.phase === 'error') {
      expect(last.retryable).toBe(false)
    }
  })
})
