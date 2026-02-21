import { describe, it, expect } from 'vitest'
import { transition, initialState } from '@/lib/upload-state'
import type { UploadState, UploadEvent, FileInfo } from '@/lib/upload-state'

const testFile: FileInfo = { name: 'test.csv', size: 5242880, type: 'text/csv' }

describe('upload state machine', () => {
  describe('idle phase', () => {
    it('starts in idle', () => {
      expect(initialState).toEqual({ phase: 'idle' })
    })

    it('idle + FILE_SELECTED -> validating', () => {
      const next = transition(initialState, { type: 'FILE_SELECTED', file: testFile })
      expect(next).toEqual({ phase: 'validating', file: testFile })
    })

    it('idle ignores CHUNK_SENT', () => {
      const next = transition(initialState, { type: 'CHUNK_SENT', chunkIndex: 0, bytesSent: 1024 })
      expect(next).toEqual(initialState)
    })
  })

  describe('validating phase', () => {
    const validating: UploadState = { phase: 'validating', file: testFile }

    it('validating + VALIDATION_PASSED -> uploading', () => {
      const next = transition(validating, {
        type: 'VALIDATION_PASSED',
        sessionId: 'sess-123',
        chunksTotal: 5,
      })
      expect(next).toEqual({
        phase: 'uploading',
        file: testFile,
        sessionId: 'sess-123',
        bytesSent: 0,
        bytesTotal: testFile.size,
        chunksCompleted: 0,
        chunksTotal: 5,
      })
    })

    it('validating + VALIDATION_FAILED -> error (not retryable)', () => {
      const next = transition(validating, {
        type: 'VALIDATION_FAILED',
        message: 'Not a CSV file',
      })
      expect(next).toEqual({
        phase: 'error',
        message: 'Not a CSV file',
        retryable: false,
        file: testFile,
      })
    })
  })

  describe('uploading phase', () => {
    const uploading: UploadState = {
      phase: 'uploading',
      file: testFile,
      sessionId: 'sess-123',
      bytesSent: 0,
      bytesTotal: testFile.size,
      chunksCompleted: 0,
      chunksTotal: 5,
    }

    it('uploading + CHUNK_SENT updates progress', () => {
      const next = transition(uploading, {
        type: 'CHUNK_SENT',
        chunkIndex: 0,
        bytesSent: 1048576,
      })
      expect(next).toEqual({
        ...uploading,
        bytesSent: 1048576,
        chunksCompleted: 1,
      })
    })

    it('uploading + last CHUNK_SENT -> finalizing', () => {
      const almostDone: UploadState = {
        ...uploading,
        bytesSent: 4194304,
        chunksCompleted: 4,
      }
      const next = transition(almostDone, {
        type: 'CHUNK_SENT',
        chunkIndex: 4,
        bytesSent: testFile.size,
      })
      expect(next).toEqual({
        phase: 'finalizing',
        file: testFile,
        sessionId: 'sess-123',
      })
    })

    it('uploading + CHUNK_FAILED -> error (retryable)', () => {
      const next = transition(uploading, {
        type: 'CHUNK_FAILED',
        chunkIndex: 2,
        message: 'Network error',
      })
      expect(next).toEqual({
        phase: 'error',
        message: 'Network error',
        retryable: true,
        file: testFile,
        sessionId: 'sess-123',
      })
    })

    it('uploading + CANCEL -> idle', () => {
      const next = transition(uploading, { type: 'CANCEL' })
      expect(next).toEqual({ phase: 'idle' })
    })
  })

  describe('finalizing phase', () => {
    const finalizing: UploadState = {
      phase: 'finalizing',
      file: testFile,
      sessionId: 'sess-123',
    }

    it('finalizing + FINALIZE_SUCCESS -> done', () => {
      const next = transition(finalizing, { type: 'FINALIZE_SUCCESS' })
      expect(next).toEqual({ phase: 'done', sessionId: 'sess-123' })
    })

    it('finalizing + FINALIZE_FAILED -> error (retryable)', () => {
      const next = transition(finalizing, {
        type: 'FINALIZE_FAILED',
        message: 'Server error',
      })
      expect(next).toEqual({
        phase: 'error',
        message: 'Server error',
        retryable: true,
        file: testFile,
        sessionId: 'sess-123',
      })
    })
  })

  describe('done phase', () => {
    const done: UploadState = { phase: 'done', sessionId: 'sess-123' }

    it('done + RESET -> idle', () => {
      const next = transition(done, { type: 'RESET' })
      expect(next).toEqual({ phase: 'idle' })
    })

    it('done + FILE_SELECTED -> validating (new upload)', () => {
      const next = transition(done, { type: 'FILE_SELECTED', file: testFile })
      expect(next).toEqual({ phase: 'validating', file: testFile })
    })
  })

  describe('error phase', () => {
    const retryableError: UploadState = {
      phase: 'error',
      message: 'Network error',
      retryable: true,
      file: testFile,
      sessionId: 'sess-123',
    }

    const nonRetryableError: UploadState = {
      phase: 'error',
      message: 'Not a CSV',
      retryable: false,
      file: testFile,
    }

    it('retryable error + FILE_SELECTED -> validating', () => {
      const next = transition(retryableError, { type: 'FILE_SELECTED', file: testFile })
      expect(next).toEqual({ phase: 'validating', file: testFile })
    })

    it('non-retryable error + FILE_SELECTED -> validating', () => {
      const next = transition(nonRetryableError, { type: 'FILE_SELECTED', file: testFile })
      expect(next).toEqual({ phase: 'validating', file: testFile })
    })

    it('error + RESET -> idle', () => {
      const next = transition(retryableError, { type: 'RESET' })
      expect(next).toEqual({ phase: 'idle' })
    })
  })

  describe('universal transitions', () => {
    const phases: UploadState[] = [
      { phase: 'validating', file: testFile },
      {
        phase: 'uploading', file: testFile, sessionId: 's',
        bytesSent: 0, bytesTotal: 100, chunksCompleted: 0, chunksTotal: 1,
      },
      { phase: 'finalizing', file: testFile, sessionId: 's' },
    ]

    it('CANCEL returns to idle from any active phase', () => {
      for (const state of phases) {
        const next = transition(state, { type: 'CANCEL' })
        expect(next).toEqual({ phase: 'idle' })
      }
    })

    it('RESET returns to idle from any phase', () => {
      for (const state of [...phases, { phase: 'done' as const, sessionId: 's' }]) {
        const next = transition(state, { type: 'RESET' })
        expect(next).toEqual({ phase: 'idle' })
      }
    })
  })
})
