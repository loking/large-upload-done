"use client"

import { useState } from "react"
import DataPreviewTable from "@/components/DataPreviewTable"

interface CompletedUpload {
  name: string
  sessionId: string
}

interface MultiPreviewSelectorProps {
  uploads: CompletedUpload[]
  onUploadMore?: () => void
}

export default function MultiPreviewSelector({ uploads, onUploadMore }: MultiPreviewSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (uploads.length === 0) return null

  const current = uploads[selectedIndex]

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {uploads.length > 1 && (
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {uploads.map((u, i) => (
              <option key={u.sessionId} value={i}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        {onUploadMore && (
          <button
            onClick={onUploadMore}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid #d1d5db",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Upload more
          </button>
        )}
      </div>
      <DataPreviewTable sessionId={current.sessionId} />
    </div>
  )
}
