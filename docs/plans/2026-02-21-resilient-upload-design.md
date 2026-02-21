# Design: Resilient Large-File Upload & Data Preview

**Date:** 2026-02-21
**Approach:** Pure Core + Thin Shell
**State model:** Discriminated union (pure TypeScript, zero deps)
**TDD scope:** Pure logic + React hooks
**Test script:** CLI smoke test (no browser)

---

## Architecture

```
Pure logic (testable)          React layer (thin wrapper)
+---------------------+       +------------------+
| uploadStateMachine   |------>| useChunkedUpload  |
| (state, event)->state|       | (calls machine)   |
+---------------------+       +------------------+
| chunkOrchestrator    |------>| UploadWizard      |
| (async, injectable)  |       | (renders state)   |
+---------------------+       +------------------+
| csvAnalyzer          |------>| DataPreviewTable  |
| (stats, warnings)    |       | (smart display)   |
+---------------------+       +------------------+
```

## File Structure

```
lib/
  upload-state.ts        # Pure state machine (discriminated union + transition fn)
  upload-orchestrator.ts # Async chunk sender (injectable fetch, emits events)
  csv-analyzer.ts        # Column stats, type inference, schema warnings
  csv.ts                 # (existing) CSV parsing - keep, extend
  storage.ts             # (existing) server-side storage - untouched
  types.ts               # (existing) shared types - extend

hooks/
  useChunkedUpload.ts    # (existing) rewrite to wrap state machine + orchestrator

components/
  UploadWizard.tsx       # (existing) rewrite to render based on state phases
  DataPreviewTable.tsx   # (existing) rewrite with column stats + sticky table
  ColumnStatsPanel.tsx   # NEW: column-level summary

__tests__/
  upload-state.test.ts
  upload-orchestrator.test.ts
  csv-analyzer.test.ts
  useChunkedUpload.test.ts

scripts/
  smoke-test.ts          # CLI smoke test
  generate-sample-csv.ts # (existing) keep as-is
```

## State Machine

### State Type (discriminated union)

```ts
type UploadState =
  | { phase: 'idle' }
  | { phase: 'validating'; file: FileInfo }
  | { phase: 'uploading'; file: FileInfo; sessionId: string;
      bytesSent: number; bytesTotal: number; chunksCompleted: number; chunksTotal: number }
  | { phase: 'retrying'; file: FileInfo; sessionId: string;
      bytesSent: number; bytesTotal: number; failedChunkIndex: number; attempt: number }
  | { phase: 'finalizing'; file: FileInfo; sessionId: string }
  | { phase: 'done'; sessionId: string }
  | { phase: 'error'; message: string; retryable: boolean;
      file?: FileInfo; sessionId?: string }

type FileInfo = { name: string; size: number; type: string }
```

### Events

```ts
type UploadEvent =
  | { type: 'FILE_SELECTED'; file: FileInfo }
  | { type: 'VALIDATION_PASSED'; sessionId: string; chunksTotal: number }
  | { type: 'VALIDATION_FAILED'; message: string }
  | { type: 'CHUNK_SENT'; chunkIndex: number; bytesSent: number }
  | { type: 'CHUNK_FAILED'; chunkIndex: number; message: string }
  | { type: 'RETRY_CHUNK'; attempt: number }
  | { type: 'FINALIZE_SUCCESS' }
  | { type: 'FINALIZE_FAILED'; message: string }
  | { type: 'CANCEL' }
  | { type: 'RESET' }
```

### Transition function

Pure function: `(state: UploadState, event: UploadEvent) => UploadState`

Key decisions:
- `retrying` is a distinct phase, not a flag
- `error.retryable` tells UI whether to show Retry button
- `bytesSent` gives byte-level progress accuracy
- `FileInfo` carried through phases for context
- Invalid transitions return current state unchanged

## Chunk Orchestrator

Injectable dependencies for testability:

```ts
type ChunkSender = (sessionId: string, chunkIndex: number,
                     data: ArrayBuffer, signal: AbortSignal) => Promise<void>

interface OrchestratorConfig {
  chunkSize: number       // default: 1MB
  maxRetries: number      // default: 3
  retryDelayMs: number    // default: 1000
  onStateChange: (state: UploadState) => void
}
```

Behavior:
1. Validates file (CSV, non-empty)
2. Sends chunks sequentially with auto-retry (up to 3 attempts, 1s delay)
3. 4xx = not retryable, 5xx/network = retryable
4. Retry resumes from failed chunk, not from start
5. Cancel aborts via AbortController, returns to idle

## UX Phases

| Phase | User sees | Key elements |
|-------|-----------|-------------|
| idle | File picker | "Choose a CSV file" |
| validating | "Checking your file..." | Spinner, file info |
| uploading | Progress bar | Byte-accurate: "45.2 MB of 98.1 MB" |
| retrying | "Retrying..." | Warning color, "Attempt 2 of 3" |
| finalizing | "Processing..." | Indeterminate spinner |
| done | Success | Green check, preview appears inline |
| error | Clear error + action | Retry button if retryable |

Key UX decisions:
- No "success" until finalize completes
- Cancel returns to idle (not a separate state)
- Error messages are actionable, not technical
- Preview appears inline after success (no navigation)

## Data Preview

### Column Stats Panel

Shows per-column: name, inferred type (color-coded), empty %, sample values/range, warnings.

### Row Preview Table

- First 50 rows, horizontally scrollable
- Sticky first column + sticky header
- Auto-sized columns (capped width)
- Row numbers in gutter

### csv-analyzer.ts (pure logic)

```ts
type ColumnStats = {
  name: string
  inferredType: 'number' | 'boolean' | 'string' | 'date' | 'unknown'
  emptyCount: number
  totalCount: number
  sampleValues: string[]
  numericRange?: { min: number; max: number }
  warnings: string[]
}
```

New: date type detection added to existing number/boolean/string inference.

## TDD Plan

### Test files

- `upload-state.test.ts` (~15 tests) - state transitions
- `upload-orchestrator.test.ts` (~10 tests) - async flow with mocked deps
- `csv-analyzer.test.ts` (~8 tests) - column analysis
- `useChunkedUpload.test.ts` (~6 tests) - React hook behavior

### Framework

Vitest + @testing-library/react for hook tests.

### Workflow

Write test (RED) -> Implement minimum (GREEN) -> Refactor -> Next test.

## CLI Smoke Test

`scripts/smoke-test.ts` - validates full upload flow via API calls:

1. Generate 5MB CSV in memory (no temp files)
2. POST /api/upload/init
3. Send chunks (5 x 1MB)
4. POST /api/upload/finalize
5. Verify preview response (columns, types, row count)

Requires dev server running. Run via `pnpm run smoke-test`.

## Explicit Non-Goals

- Parallel chunk uploads (adds complexity, minimal benefit for local server)
- Resumable uploads across sessions (needs server-side tracking)
- Offline detection (over-engineering for local app)
- Exponential backoff (fixed 1s delay is pragmatic)
- File drag-and-drop (nice-to-have, not core)

## Edge Cases Handled

- Chunk failure: auto-retry 3x, then error with retryable=true
- Init failure: error with retryable=true
- Finalize failure: error, re-calls finalize only (not re-upload)
- 4xx: error with retryable=false (bad request, don't retry)
- 5xx/network: error with retryable=true
- Cancel mid-upload: AbortController, return to idle
- Empty file: caught in validation
- Non-CSV file: caught in validation
- Tab close during upload: upload lost (expected, documented)
