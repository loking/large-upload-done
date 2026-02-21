"use client"

import { useState, useEffect, useRef } from "react"
import { useChunkedUpload } from "@/hooks/useChunkedUpload"
import DropZone from "@/components/DropZone"
import MultiPreviewSelector from "@/components/MultiPreviewSelector"

function formatBytes(n: number) {
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let x = n
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024
    i++
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

interface CompletedUpload {
  name: string
  sessionId: string
}

export default function UploadWizard() {
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [completedUploads, setCompletedUploads] = useState<CompletedUpload[]>([])
  const [uploadingIndex, setUploadingIndex] = useState(-1)
  const { state, start, cancel, reset, sessionId } = useChunkedUpload()
  const prevPhaseRef = useRef(state.phase)

  // When a file finishes uploading, record it and start the next
  useEffect(() => {
    const prevPhase = prevPhaseRef.current
    prevPhaseRef.current = state.phase

    if (state.phase === "done" && prevPhase !== "done" && sessionId) {
      const justUploaded = pendingFiles[uploadingIndex]
      if (justUploaded) {
        setCompletedUploads((prev) => [
          ...prev,
          { name: justUploaded.name, sessionId },
        ])
      }

      const nextIndex = uploadingIndex + 1
      if (nextIndex < pendingFiles.length) {
        setUploadingIndex(nextIndex)
        reset()
        start(pendingFiles[nextIndex])
      }
    }
  }, [state.phase, sessionId, pendingFiles, uploadingIndex, reset, start])

  const allDone =
    completedUploads.length > 0 &&
    completedUploads.length === pendingFiles.length &&
    state.phase === "done"

  const handleFilesSelected = (selected: File[]) => {
    setPendingFiles((prev) => [...prev, ...selected])
  }

  const handleRemoveFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStart = () => {
    if (pendingFiles.length === 0) return
    setUploadingIndex(0)
    start(pendingFiles[0])
  }

  const handleReset = () => {
    reset()
    setPendingFiles([])
    setCompletedUploads([])
    setUploadingIndex(-1)
  }

  const handleUploadMore = () => {
    reset()
    setPendingFiles([])
    setUploadingIndex(-1)
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* DropZone always visible when idle or all done */}
      {(state.phase === "idle" || allDone) && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 20 }}>
          <DropZone onFilesSelected={handleFilesSelected} />
          {pendingFiles.length > 0 && !allDone && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {pendingFiles.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#f9fafb",
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: "#333" }}>
                    {f.name} <span style={{ color: "#888" }}>({formatBytes(f.size)})</span>
                  </span>
                  <button
                    onClick={() => handleRemoveFile(i)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#999",
                      fontSize: 16,
                      padding: "0 4px",
                      lineHeight: 1,
                    }}
                    aria-label={`Remove ${f.name}`}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          {pendingFiles.length > 0 && !allDone && (
            <button
              onClick={handleStart}
              style={{
                marginTop: 12,
                padding: "10px 20px",
                borderRadius: 8,
                background: "#111",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Start upload
            </button>
          )}
        </div>
      )}

      {/* Phase: Validating */}
      {state.phase === "validating" && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Spinner />
            <div>
              <div style={{ fontWeight: 600 }}>Checking your file...</div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                {state.file.name} ({formatBytes(state.file.size)})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase: Uploading */}
      {state.phase === "uploading" && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                Uploading {pendingFiles.length > 1
                  ? `file ${uploadingIndex + 1} of ${pendingFiles.length}...`
                  : "your file..."}
              </div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                {state.file.name} &mdash; {formatBytes(state.bytesSent)} of {formatBytes(state.bytesTotal)}
              </div>
            </div>
            <button
              onClick={cancel}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid #ddd",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Cancel
            </button>
          </div>

          <ProgressBar
            percent={state.bytesTotal > 0 ? (state.bytesSent / state.bytesTotal) * 100 : 0}
            color="#111"
          />

          <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
            Chunk {state.chunksCompleted} of {state.chunksTotal}
          </div>
        </div>
      )}

      {/* Phase: Finalizing */}
      {state.phase === "finalizing" && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Spinner />
            <div>
              <div style={{ fontWeight: 600 }}>Processing your file...</div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                Upload complete. Assembling and preparing preview.
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <ProgressBar percent={100} color="#111" />
          </div>
        </div>
      )}

      {/* Phase: Done - show success + multi-preview when all files complete */}
      {allDone && (
        <div style={{ border: "1px solid #16a34a", borderRadius: 12, padding: 20, background: "#f0fdf4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20, color: "#16a34a" }}>&#10003;</span>
            <div>
              <div style={{ fontWeight: 600, color: "#15803d" }}>
                {completedUploads.length === 1
                  ? "Upload complete"
                  : `All ${completedUploads.length} files uploaded`}
              </div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                {completedUploads.length === 1
                  ? "Your file has been uploaded and processed successfully."
                  : "All files have been uploaded and processed successfully."}
              </div>
            </div>
          </div>
        </div>
      )}

      {allDone && (
        <MultiPreviewSelector uploads={completedUploads} />
      )}

      {/* Phase: Error */}
      {state.phase === "error" && (
        <div style={{ border: "1px solid #dc2626", borderRadius: 12, padding: 20, background: "#fef2f2" }}>
          <div style={{ fontWeight: 600, color: "#dc2626", marginBottom: 6 }}>
            Something went wrong
          </div>
          <div style={{ color: "#666", fontSize: 14, marginBottom: 12 }}>
            {state.message}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {state.retryable && pendingFiles.length > 0 && uploadingIndex >= 0 && (
              <button
                onClick={() => start(pendingFiles[uploadingIndex])}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#111",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Retry
              </button>
            )}
            <button
              onClick={handleReset}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid #ddd",
                cursor: "pointer",
              }}
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div style={{ background: "#f2f2f2", borderRadius: 999, height: 8, overflow: "hidden" }}>
      <div
        style={{
          width: `${Math.min(100, Math.round(percent))}%`,
          height: "100%",
          background: color,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  )
}

function Spinner() {
  return (
    <div
      style={{
        width: 20,
        height: 20,
        border: "2px solid #e5e5e5",
        borderTopColor: "#111",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  )
}
