"use client"

import { useMemo } from "react"
import DataPreviewTable from "@/components/DataPreviewTable"

export default function PreviewPage() {
  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return null
    const sp = new URLSearchParams(window.location.search)
    return sp.get("sessionId")
  }, [])

  return (
    <main>
      <h1 style={{ margin: "8px 0 4px" }}>Preview</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Sanity-check your uploaded data: column summary + first rows.
      </p>
      {sessionId ? (
        <DataPreviewTable sessionId={sessionId} />
      ) : (
        <div style={{ color: "#666" }}>
          Missing sessionId. Upload a file first, then come back here.
        </div>
      )}
    </main>
  )
}
