"use client"

import { useState } from "react"
import { useChunkedUpload } from "@/hooks/useChunkedUpload"
import DataPreviewTable from "@/components/DataPreviewTable"

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

export default function UploadWizard() {
  const [file, setFile] = useState<File | null>(null)
  const { state, start, cancel, reset, sessionId } = useChunkedUpload()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
  }

  const handleStart = () => {
    if (!file) return
    start(file)
  }

  const handleReset = () => {
    reset()
    setFile(null)
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Phase: File Selection (idle, error, done) */}
      {(state.phase === "idle" || state.phase === "error" || state.phase === "done") && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>
            {state.phase === "done" ? "Upload another file" : "Select a CSV file"}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
            />
            {file && (
              <span style={{ color: "#444", fontSize: 14 }}>
                {file.name} ({formatBytes(file.size)})
              </span>
            )}
          </div>
          {file && (
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
              <div style={{ fontWeight: 600 }}>Uploading your file...</div>
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

      {/* Phase: Done */}
      {state.phase === "done" && (
        <div style={{ border: "1px solid #16a34a", borderRadius: 12, padding: 20, background: "#f0fdf4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20, color: "#16a34a" }}>&#10003;</span>
            <div>
              <div style={{ fontWeight: 600, color: "#15803d" }}>Upload complete</div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                Your file has been uploaded and processed successfully.
              </div>
            </div>
          </div>
          <button
            onClick={handleReset}
            style={{
              marginTop: 12,
              padding: "6px 14px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid #ddd",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Upload another file
          </button>
        </div>
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
            {state.retryable && file && (
              <button
                onClick={() => { if (file) start(file) }}
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

      {/* Inline Preview (after done) */}
      {state.phase === "done" && sessionId && (
        <DataPreviewTable sessionId={sessionId} />
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
