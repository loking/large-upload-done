# Decisions

## What I changed and why

### 1. State machine with discriminated union

**Changed:** Replaced 5 independent `useState` calls ("boolean soup") with a single discriminated union type `UploadState` and a pure `transition()` function.

**Why:** The original code allowed impossible states (e.g., `status = "done"` with `progress = 0.3` and `error = "something"`). The discriminated union makes illegal states unrepresentable at the type level. Each phase carries exactly the data it needs — `sessionId` only exists when it should, progress only during uploading.

**Impact:** The transition function is a pure function — no React, no side effects. This enabled TDD with simple input/output assertions.

### 2. Separated orchestrator from React

**Changed:** Extracted chunk upload orchestration into a pure async module (`upload-orchestrator.ts`) with injectable dependencies.

**Why:** The original hook mixed I/O (fetch calls), state management, and React lifecycle into one function. By injecting `init`, `sendChunk`, and `finalize` as function parameters, the orchestrator is testable without mocking `fetch` or rendering React components.

**Impact:** Tests run in milliseconds, no DOM, no network. The hook becomes a thin wrapper that wires real `fetch` calls to the orchestrator.

### 3. Byte-accurate progress

**Changed:** Progress is now calculated from `bytesSent / bytesTotal` instead of `chunksCompleted / chunksTotal`.

**Why:** Chunk-count-based progress is misleading for users — a 100MB file with 100 chunks jumps in 1% increments. Byte-based progress is smoother and more honest.

### 4. Auto-retry with max attempts

**Changed:** Added automatic retry (up to 3 attempts with 1s delay) for failed chunks. 4xx errors are not retried; 5xx and network errors are.

**Why:** Transient network failures are common during large uploads. Users shouldn't have to manually retry each time. But retrying a 400 Bad Request would just fail again.

### 5. Column stats panel for data preview

**Changed:** Added a `ColumnStatsPanel` that shows per-column type inference, empty percentage, sample values, and data quality warnings.

**Why:** A flat table of 100 columns is unusable. The stats panel gives users a scannable overview — they can see at a glance whether their data looks right before scrolling through rows. Warnings (e.g., "75% of values are empty") surface issues early.

### 6. Inline preview after upload

**Changed:** Preview now appears on the same page after upload completes, instead of requiring navigation to `/preview`.

**Why:** Reduces friction. The user's mental model is "upload → see data." Navigating to a separate page adds a step and loses context.

## What I intentionally did not do

- **Parallel chunk uploads:** Sequential is simpler and correct. The local dev server doesn't benefit from parallelism, and it would add ordering complexity.
- **Resumable uploads across sessions:** Would require server-side chunk tracking (knowing which chunks have been received). This is a backend concern, not a frontend one.
- **Drag-and-drop file selection:** Nice UX but doesn't demonstrate systems thinking. File input works.
- **Exponential backoff:** A fixed 1s retry delay is pragmatic for a local app. Exponential backoff matters for production APIs with rate limits.
- **Component-level tests:** TDD covers the pure logic and hook layers. Component rendering is straightforward conditional rendering — it doesn't have logic worth testing independently.

### A note on TDD

The exercise says testing is optional, but I used TDD by default. When developing with AI tools, code generation is fast but regressions are easy — the AI can confidently produce code that subtly breaks existing behavior. Writing tests first creates a safety net: each iteration is validated against the spec before moving on. This is especially important for stateful logic like the upload state machine, where a small transition bug could silently corrupt the entire flow. TDD is my standard practice for any AI-assisted development, regardless of whether tests are required.

### A note on the smoke test

I included a CLI smoke test (`scripts/smoke-test.ts`) that generates a 50K-row CSV in memory and runs the full init → chunk → finalize → verify flow against the dev server. I always keep a simple script — either a Node.js CLI script or a Playwright test — that exercises the core happy path end-to-end. Unit tests verify logic in isolation, but a smoke test catches integration issues (wrong headers, mismatched API contracts, broken assembly) that unit tests can't. It runs in seconds and gives confidence that the system actually works, not just that the parts do.
- **Offline detection:** Over-engineering for a local-only app.
- **Visual polish:** The UI uses functional inline styles rather than a design system or CSS framework. As a test app under time constraints, effort was better spent on state management and robustness than visual refinement.

## Tradeoffs

| Decision | Gained | Lost |
|----------|--------|------|
| Discriminated union over XState | Zero dependencies, simpler mental model | No visual state chart, less formal guards |
| Sequential chunks | Simplicity, correctness | Slower uploads on fast networks |
| Inline preview | Reduced friction | Slightly longer page on upload route |
| 50-row preview cap | Fast rendering, predictable layout | Users can't browse all data (by design) |
| Client-side column analysis | No backend changes needed | Analysis limited to preview rows, not full dataset |

## What I would ask the backend for next

1. **Chunk receipt confirmation:** An endpoint to query which chunks the server has received, enabling true resumable uploads.
2. **Full-file column stats:** Server-side analysis of the entire file (not just preview rows) for accurate type inference and null counts.
3. **Upload session expiry:** How long do uploaded chunks persist? Should the frontend warn users about stale sessions?
4. **File size limits:** What's the actual max file size? Should we validate before uploading?
5. **Content-type validation:** Server-side CSV validation to catch encoding issues or malformed files early.
