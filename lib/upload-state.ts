export type FileInfo = {
  name: string
  size: number
  type: string
}

export type UploadState =
  | { phase: 'idle' }
  | { phase: 'validating'; file: FileInfo }
  | { phase: 'uploading'; file: FileInfo; sessionId: string;
      bytesSent: number; bytesTotal: number; chunksCompleted: number; chunksTotal: number }
  | { phase: 'finalizing'; file: FileInfo; sessionId: string }
  | { phase: 'done'; sessionId: string }
  | { phase: 'error'; message: string; retryable: boolean;
      file?: FileInfo; sessionId?: string }

export type UploadEvent =
  | { type: 'FILE_SELECTED'; file: FileInfo }
  | { type: 'VALIDATION_PASSED'; sessionId: string; chunksTotal: number }
  | { type: 'VALIDATION_FAILED'; message: string }
  | { type: 'CHUNK_SENT'; chunkIndex: number; bytesSent: number }
  | { type: 'CHUNK_FAILED'; chunkIndex: number; message: string }
  | { type: 'FINALIZE_SUCCESS' }
  | { type: 'FINALIZE_FAILED'; message: string }
  | { type: 'CANCEL' }
  | { type: 'RESET' }

export const initialState: UploadState = { phase: 'idle' }

export function transition(state: UploadState, event: UploadEvent): UploadState {
  if (event.type === 'RESET') return { phase: 'idle' }

  if (event.type === 'CANCEL') {
    if (state.phase === 'validating' || state.phase === 'uploading' || state.phase === 'finalizing') {
      return { phase: 'idle' }
    }
    return state
  }

  if (event.type === 'FILE_SELECTED') {
    if (state.phase === 'idle' || state.phase === 'done' || state.phase === 'error') {
      return { phase: 'validating', file: event.file }
    }
    return state
  }

  switch (state.phase) {
    case 'validating': {
      if (event.type === 'VALIDATION_PASSED') {
        return {
          phase: 'uploading',
          file: state.file,
          sessionId: event.sessionId,
          bytesSent: 0,
          bytesTotal: state.file.size,
          chunksCompleted: 0,
          chunksTotal: event.chunksTotal,
        }
      }
      if (event.type === 'VALIDATION_FAILED') {
        return {
          phase: 'error',
          message: event.message,
          retryable: false,
          file: state.file,
        }
      }
      return state
    }

    case 'uploading': {
      if (event.type === 'CHUNK_SENT') {
        const chunksCompleted = state.chunksCompleted + 1
        if (chunksCompleted >= state.chunksTotal) {
          return {
            phase: 'finalizing',
            file: state.file,
            sessionId: state.sessionId,
          }
        }
        return {
          ...state,
          bytesSent: event.bytesSent,
          chunksCompleted,
        }
      }
      if (event.type === 'CHUNK_FAILED') {
        return {
          phase: 'error',
          message: event.message,
          retryable: true,
          file: state.file,
          sessionId: state.sessionId,
        }
      }
      return state
    }

    case 'finalizing': {
      if (event.type === 'FINALIZE_SUCCESS') {
        return { phase: 'done', sessionId: state.sessionId }
      }
      if (event.type === 'FINALIZE_FAILED') {
        return {
          phase: 'error',
          message: event.message,
          retryable: true,
          file: state.file,
          sessionId: state.sessionId,
        }
      }
      return state
    }

    default:
      return state
  }
}
