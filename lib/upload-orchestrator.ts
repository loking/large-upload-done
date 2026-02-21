import { transition, initialState } from './upload-state'
import type { UploadState, UploadEvent, FileInfo } from './upload-state'

export type ChunkSender = (
  sessionId: string,
  chunkIndex: number,
  data: ArrayBuffer,
  signal: AbortSignal
) => Promise<void>

export type UploadInitializer = (
  file: FileInfo,
  signal: AbortSignal
) => Promise<{ sessionId: string }>

export type UploadFinalizer = (
  sessionId: string,
  signal: AbortSignal
) => Promise<void>

export interface OrchestratorConfig {
  chunkSize: number
  maxRetries: number
  retryDelayMs: number
  onStateChange: (state: UploadState) => void
}

export function createOrchestrator(
  init: UploadInitializer,
  sendChunk: ChunkSender,
  finalize: UploadFinalizer,
  config: OrchestratorConfig
) {
  let abortController: AbortController | null = null
  let currentState: UploadState = initialState

  function emit(event: UploadEvent) {
    currentState = transition(currentState, event)
    config.onStateChange(currentState)
  }

  function isAborted(): boolean {
    return abortController?.signal.aborted ?? false
  }

  async function start(file: File) {
    currentState = initialState
    abortController = new AbortController()
    const signal = abortController.signal

    const fileInfo: FileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
    }

    // Validate
    emit({ type: 'FILE_SELECTED', file: fileInfo })

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      emit({ type: 'VALIDATION_FAILED', message: 'Please select a CSV file.' })
      return
    }

    if (file.size === 0) {
      emit({ type: 'VALIDATION_FAILED', message: 'This file appears to be empty.' })
      return
    }

    // Init
    const chunksTotal = Math.ceil(file.size / config.chunkSize)

    try {
      const { sessionId } = await init(fileInfo, signal)
      if (isAborted()) { emit({ type: 'CANCEL' }); return }

      emit({ type: 'VALIDATION_PASSED', sessionId, chunksTotal })

      // Send chunks
      for (let i = 0; i < chunksTotal; i++) {
        if (isAborted()) { emit({ type: 'CANCEL' }); return }

        const startByte = i * config.chunkSize
        const endByte = Math.min(startByte + config.chunkSize, file.size)
        const blob = file.slice(startByte, endByte)
        const buf = await blob.arrayBuffer()

        let sent = false
        for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
          try {
            await sendChunk(sessionId, i, buf, signal)
            if (isAborted()) { emit({ type: 'CANCEL' }); return }
            sent = true
            break
          } catch (err) {
            if (isAborted()) { emit({ type: 'CANCEL' }); return }
            if (attempt >= config.maxRetries) {
              const message = err instanceof Error ? err.message : 'Chunk upload failed'
              emit({ type: 'CHUNK_FAILED', chunkIndex: i, message })
              return
            }
            if (config.retryDelayMs > 0) {
              await new Promise((r) => setTimeout(r, config.retryDelayMs))
            }
          }
        }

        if (sent) {
          emit({ type: 'CHUNK_SENT', chunkIndex: i, bytesSent: endByte })
        }
      }

      // Finalize
      try {
        await finalize(sessionId, signal)
        if (isAborted()) { emit({ type: 'CANCEL' }); return }
        emit({ type: 'FINALIZE_SUCCESS' })
      } catch (err) {
        if (isAborted()) { emit({ type: 'CANCEL' }); return }
        const message = err instanceof Error ? err.message : 'finalize failed'
        emit({ type: 'FINALIZE_FAILED', message })
      }
    } catch (err) {
      if (isAborted()) { emit({ type: 'CANCEL' }); return }
      // Init failed — transition to uploading so CHUNK_FAILED produces a retryable error
      emit({ type: 'VALIDATION_PASSED', sessionId: '', chunksTotal })
      emit({ type: 'CHUNK_FAILED', chunkIndex: 0, message: 'Could not start upload. Check your connection.' })
    }
  }

  function cancel() {
    abortController?.abort()
    emit({ type: 'CANCEL' })
  }

  return { start, cancel }
}
