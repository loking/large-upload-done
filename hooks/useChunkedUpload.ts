"use client"

import { useCallback, useRef, useState } from "react"
import { createOrchestrator } from "@/lib/upload-orchestrator"
import { initialState } from "@/lib/upload-state"
import type { UploadState } from "@/lib/upload-state"

const DEFAULT_CHUNK_SIZE = 1024 * 1024 // 1MB

interface UseChunkedUploadOptions {
  chunkSize?: number
  maxRetries?: number
  retryDelayMs?: number
}

export function useChunkedUpload(options?: UseChunkedUploadOptions) {
  const [state, setState] = useState<UploadState>(initialState)
  const orchestratorRef = useRef<ReturnType<typeof createOrchestrator> | null>(null)

  const sessionId = (() => {
    if (state.phase === 'uploading' || state.phase === 'finalizing') return state.sessionId
    if (state.phase === 'done') return state.sessionId
    if (state.phase === 'error' && state.sessionId) return state.sessionId
    return null
  })()

  const start = useCallback(async (file: File) => {
    const initFn = async (fileInfo: { name: string; size: number; type: string }, signal: AbortSignal) => {
      const res = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: fileInfo.name, size: fileInfo.size }),
        signal,
      })
      if (!res.ok) throw new Error(`Upload initialization failed (${res.status})`)
      const json = await res.json()
      return { sessionId: json.sessionId as string }
    }

    const sendChunkFn = async (sid: string, idx: number, data: ArrayBuffer, signal: AbortSignal) => {
      const totalChunks = Math.ceil(file.size / (options?.chunkSize ?? DEFAULT_CHUNK_SIZE))
      const res = await fetch("/api/upload/chunk", {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-session-id": sid,
          "x-chunk-index": String(idx),
          "x-total-chunks": String(totalChunks),
        },
        body: data,
        signal,
      })
      if (!res.ok) throw new Error(`Chunk ${idx} upload failed (${res.status})`)
    }

    const finalizeFn = async (sid: string, signal: AbortSignal) => {
      const res = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
        signal,
      })
      if (!res.ok) throw new Error(`File processing failed (${res.status})`)
    }

    const orchestrator = createOrchestrator(initFn, sendChunkFn, finalizeFn, {
      chunkSize: options?.chunkSize ?? DEFAULT_CHUNK_SIZE,
      maxRetries: options?.maxRetries ?? 3,
      retryDelayMs: options?.retryDelayMs ?? 1000,
      onStateChange: setState,
    })

    orchestratorRef.current = orchestrator
    await orchestrator.start(file)
  }, [options?.chunkSize, options?.maxRetries, options?.retryDelayMs])

  const cancel = useCallback(() => {
    orchestratorRef.current?.cancel()
  }, [])

  const reset = useCallback(() => {
    orchestratorRef.current?.cancel()
    orchestratorRef.current = null
    setState(initialState)
  }, [])

  return { state, start, cancel, reset, sessionId }
}
